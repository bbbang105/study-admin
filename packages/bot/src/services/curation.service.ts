/**
 * Curation Service
 * 외부 컨퍼런스 및 아티클 큐레이션 서비스
 * Requirements: 13.1, 13.3, 13.4, 13.5
 */

import { eq, desc } from 'drizzle-orm';
import {
  getDb,
  curationSources,
  curationItems,
  type CurationSource,
  type NewCurationSource,
  type CurationItem,
  type NewCurationItem,
  CurationCategory,
} from '@blog-study/shared/db';
import logger, { serializeError } from '../lib/logger';
import { getKeywordService } from './keyword.service';

/**
 * Curation source with item count
 */
export interface CurationSourceWithCount extends CurationSource {
  itemCount?: number;
}

/**
 * Crawled content item from external source
 */
export interface CrawledContent {
  title: string;
  url: string;
  publishedAt?: Date;
  category: string;
  tags: string[];
  description?: string | null;
  thumbnailUrl?: string | null;
}

/**
 * Result of crawling a single source
 */
export interface CrawlResult {
  sourceId: string;
  sourceName: string;
  success: boolean;
  itemsFound: number;
  newItemsAdded: number;
  error?: string;
}

/**
 * Curation service for managing external content curation
 * Requirements: 13.1, 13.3, 13.4, 13.5
 */
export class CurationService {
  private db = getDb();

  /**
   * Add a new curation source
   * Requirements: 13.1 - Maintain configurable list of curated source websites
   * @param url Source URL
   * @param name Source name
   * @param category Category (conference or article)
   * @returns Created curation source
   */
  async addSource(
    url: string,
    name: string,
    category: string
  ): Promise<CurationSource> {
    // Validate category
    const validCategories = Object.values(CurationCategory);
    if (!validCategories.includes(category as typeof CurationCategory[keyof typeof CurationCategory])) {
      throw new Error(`Invalid category: ${category}. Must be one of: ${validCategories.join(', ')}`);
    }

    // Check for duplicate URL
    const existing = await this.getSourceByUrl(url);
    if (existing) {
      throw new Error(`Source with URL already exists: ${url}`);
    }

    const newSource: NewCurationSource = {
      url,
      name,
      category,
      isActive: true,
    };

    const [created] = await this.db
      .insert(curationSources)
      .values(newSource)
      .returning();

    return created!;
  }

  /**
   * Remove a curation source
   * @param sourceId Source ID to remove
   */
  async removeSource(sourceId: string): Promise<void> {
    // First delete all items from this source
    await this.db
      .delete(curationItems)
      .where(eq(curationItems.sourceId, sourceId));

    // Then delete the source
    await this.db
      .delete(curationSources)
      .where(eq(curationSources.id, sourceId));
  }

  /**
   * Get a source by URL
   * @param url Source URL
   * @returns Source or null
   */
  async getSourceByUrl(url: string): Promise<CurationSource | null> {
    const [source] = await this.db
      .select()
      .from(curationSources)
      .where(eq(curationSources.url, url))
      .limit(1);

    return source || null;
  }

  /**
   * Get a source by ID
   * @param sourceId Source ID
   * @returns Source or null
   */
  async getSourceById(sourceId: string): Promise<CurationSource | null> {
    const [source] = await this.db
      .select()
      .from(curationSources)
      .where(eq(curationSources.id, sourceId))
      .limit(1);

    return source || null;
  }

  /**
   * Get all active curation sources
   * @returns Array of active sources
   */
  async getAllActiveSources(): Promise<CurationSource[]> {
    return this.db
      .select()
      .from(curationSources)
      .where(eq(curationSources.isActive, true));
  }

  /**
   * Get all curation sources
   * @returns Array of all sources
   */
  async getAllSources(): Promise<CurationSource[]> {
    return this.db.select().from(curationSources);
  }

  /**
   * Toggle source active status
   * @param sourceId Source ID
   * @param isActive New active status
   */
  async setSourceActive(sourceId: string, isActive: boolean): Promise<void> {
    await this.db
      .update(curationSources)
      .set({ isActive })
      .where(eq(curationSources.id, sourceId));
  }


  /**
   * Add a curation item
   * Requirements: 13.4 - Store content with extracted metadata
   * @param item Item data
   * @returns Created item
   */
  async addItem(item: NewCurationItem): Promise<CurationItem> {
    // Check for duplicate URL
    const existing = await this.getItemByUrl(item.url);
    if (existing) {
      return existing;
    }

    const [created] = await this.db
      .insert(curationItems)
      .values(item)
      .returning();

    return created!;
  }

  /**
   * Get item by URL
   * @param url Item URL
   * @returns Item or null
   */
  async getItemByUrl(url: string): Promise<CurationItem | null> {
    const [item] = await this.db
      .select()
      .from(curationItems)
      .where(eq(curationItems.url, url))
      .limit(1);

    return item || null;
  }

  /**
   * Get item by ID
   * @param itemId Item ID
   * @returns Item or null
   */
  async getItemById(itemId: string): Promise<CurationItem | null> {
    const [item] = await this.db
      .select()
      .from(curationItems)
      .where(eq(curationItems.id, itemId))
      .limit(1);

    return item || null;
  }

  /**
   * Get all unshared items sorted by relevance score
   * @param limit Maximum number of items to return
   * @returns Array of unshared items
   */
  async getUnsharedItems(limit: number = 10): Promise<CurationItem[]> {
    return this.db
      .select()
      .from(curationItems)
      .where(eq(curationItems.isShared, false))
      .orderBy(desc(curationItems.relevanceScore))
      .limit(limit);
  }

  /**
   * Mark an item as shared
   * @param itemId Item ID
   */
  async markAsShared(itemId: string): Promise<void> {
    await this.db
      .update(curationItems)
      .set({
        isShared: true,
        sharedAt: new Date(),
      })
      .where(eq(curationItems.id, itemId));
  }

  /**
   * Calculate relevance score for content
   * Requirements: 13.5 - Prioritize content matching study group's interest keywords
   * Requirements: 14.4 - Use keyword frequency data to calculate relevance scores
   * @param title Content title
   * @param tags Content tags
   * @returns Relevance score (0-100)
   */
  async calculateRelevanceScore(title: string, tags: string[]): Promise<number> {
    const keywordService = getKeywordService();
    
    // Combine title and tags for analysis
    const content = [title, ...tags].join(' ');
    
    return keywordService.calculateRelevanceScore(content);
  }

  /**
   * Update relevance score for an item
   * @param itemId Item ID
   * @param score New relevance score
   */
  async updateRelevanceScore(itemId: string, score: number): Promise<void> {
    await this.db
      .update(curationItems)
      .set({ relevanceScore: score })
      .where(eq(curationItems.id, itemId));
  }

  /**
   * Crawl all active sources and collect new content
   * Requirements: 13.3 - Extract title, URL, date, category, and tags/keywords
   * Note: This is a placeholder - actual crawling logic depends on source format
   * @param crawlFunction Function to crawl a single source URL
   * @returns Array of crawl results
   */
  async crawlAllSources(
    crawlFunction?: (url: string) => Promise<CrawledContent[]>
  ): Promise<CrawlResult[]> {
    const sources = await this.getAllActiveSources();
    const results: CrawlResult[] = [];

    for (const source of sources) {
      try {
        let crawledItems: CrawledContent[] = [];
        
        if (crawlFunction) {
          crawledItems = await crawlFunction(source.url);
        }

        let newItemsAdded = 0;

        for (const crawled of crawledItems) {
          // Check if item already exists
          const existing = await this.getItemByUrl(crawled.url);
          if (existing) continue;

          // Calculate relevance score
          const relevanceScore = await this.calculateRelevanceScore(
            crawled.title,
            crawled.tags
          );

          // Add new item
          await this.addItem({
            sourceId: source.id,
            title: crawled.title,
            url: crawled.url,
            publishedAt: crawled.publishedAt,
            category: crawled.category || source.category,
            tags: crawled.tags,
            description: crawled.description,
            thumbnailUrl: crawled.thumbnailUrl,
            relevanceScore,
            isShared: false,
          });

          newItemsAdded++;
        }

        results.push({
          sourceId: source.id,
          sourceName: source.name,
          success: true,
          itemsFound: crawledItems.length,
          newItemsAdded,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ source: source.name, error: serializeError(error) }, '[CurationService] Error crawling source');
        
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          itemsFound: 0,
          newItemsAdded: 0,
          error: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * Select daily content to share
   * Requirements: 13.5 - Prioritize content matching study group's interest keywords
   * @returns Selected item or null if no unshared items
   */
  async selectDailyContent(): Promise<CurationItem | null> {
    // Get unshared items sorted by relevance score (highest first)
    const items = await this.getUnsharedItems(1);
    
    if (items.length === 0) {
      return null;
    }

    return items[0]!;
  }

  /**
   * Get items by source
   * @param sourceId Source ID
   * @param limit Maximum number of items
   * @returns Array of items
   */
  async getItemsBySource(sourceId: string, limit: number = 50): Promise<CurationItem[]> {
    return this.db
      .select()
      .from(curationItems)
      .where(eq(curationItems.sourceId, sourceId))
      .orderBy(desc(curationItems.collectedAt))
      .limit(limit);
  }

  /**
   * Get recently shared items
   * @param limit Maximum number of items
   * @returns Array of shared items
   */
  async getRecentlySharedItems(limit: number = 10): Promise<CurationItem[]> {
    return this.db
      .select()
      .from(curationItems)
      .where(eq(curationItems.isShared, true))
      .orderBy(desc(curationItems.sharedAt))
      .limit(limit);
  }

  /**
   * Delete all items (useful for testing)
   */
  async deleteAllItems(): Promise<void> {
    await this.db.delete(curationItems);
  }

  /**
   * Delete all sources (useful for testing)
   */
  async deleteAllSources(): Promise<void> {
    await this.db.delete(curationItems);
    await this.db.delete(curationSources);
  }

  /**
   * Get statistics about curation
   */
  async getStats(): Promise<{
    totalSources: number;
    activeSources: number;
    totalItems: number;
    sharedItems: number;
    unsharedItems: number;
  }> {
    const allSources = await this.getAllSources();
    const activeSources = allSources.filter(s => s.isActive);
    
    const allItems = await this.db.select().from(curationItems);
    const sharedItems = allItems.filter(i => i.isShared);
    
    return {
      totalSources: allSources.length,
      activeSources: activeSources.length,
      totalItems: allItems.length,
      sharedItems: sharedItems.length,
      unsharedItems: allItems.length - sharedItems.length,
    };
  }
}

// Singleton instance
let curationServiceInstance: CurationService | null = null;

/**
 * Get the CurationService singleton instance
 */
export function getCurationService(): CurationService {
  if (!curationServiceInstance) {
    curationServiceInstance = new CurationService();
  }
  return curationServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetCurationService(): void {
  curationServiceInstance = null;
}
