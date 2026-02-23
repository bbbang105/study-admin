/**
 * Keyword Service
 * 스터디원 관심 분야 분석 서비스
 * Requirements: 14.1, 14.2, 14.4
 */

import { eq, desc, sql } from 'drizzle-orm';
import {
  getDb,
  keywords,
  type Keyword,
  type NewKeyword,
} from '@blog-study/shared/db';
import { extractKeywordsFromPost } from '@blog-study/shared/utils';

/**
 * Keyword statistics entry
 */
export interface KeywordStat {
  keyword: string;
  frequency: number;
  lastUpdated: Date | null;
}

/**
 * Keyword service for managing interest analysis
 * Requirements: 14.1, 14.2, 14.4
 */
export class KeywordService {
  private db = getDb();

  /**
   * Extract keywords from post title and description
   * Requirements: 14.1 - Extract keywords from post title and description
   * @param title Post title
   * @param description Post description (optional)
   * @returns Array of extracted keywords
   */
  extractKeywords(title: string, description?: string): string[] {
    return extractKeywordsFromPost(title, description, {
      minLength: 2,
      maxKeywords: 20, // Limit keywords per post
    });
  }

  /**
   * Update keyword statistics in the database
   * Requirements: 14.2 - Maintain keyword frequency table
   * @param extractedKeywords Array of keywords to update
   */
  async updateKeywordStats(extractedKeywords: string[]): Promise<void> {
    if (!extractedKeywords || extractedKeywords.length === 0) {
      return;
    }

    // Deduplicate keywords
    const uniqueKeywords = [...new Set(extractedKeywords)];

    for (const keyword of uniqueKeywords) {
      // Try to find existing keyword
      const [existing] = await this.db
        .select()
        .from(keywords)
        .where(eq(keywords.keyword, keyword))
        .limit(1);

      if (existing) {
        // Increment frequency
        await this.db
          .update(keywords)
          .set({
            frequency: sql`${keywords.frequency} + 1`,
            lastUpdated: new Date(),
          })
          .where(eq(keywords.keyword, keyword));
      } else {
        // Insert new keyword
        const newKeyword: NewKeyword = {
          keyword,
          frequency: 1,
          lastUpdated: new Date(),
        };
        await this.db.insert(keywords).values(newKeyword);
      }
    }
  }


  /**
   * Get top keywords by frequency
   * Requirements: 14.3 - Display top 10 keywords with frequency counts
   * @param limit Number of keywords to return (default: 10)
   * @returns Array of keyword statistics sorted by frequency descending
   */
  async getTopKeywords(limit: number = 10): Promise<KeywordStat[]> {
    const results = await this.db
      .select()
      .from(keywords)
      .orderBy(desc(keywords.frequency))
      .limit(limit);

    return results.map((k) => ({
      keyword: k.keyword,
      frequency: k.frequency ?? 0,
      lastUpdated: k.lastUpdated,
    }));
  }

  /**
   * Calculate relevance score for content based on keyword matches
   * Requirements: 14.4 - Use keyword frequency data to calculate relevance scores
   * @param content Content text to analyze (title + tags)
   * @returns Relevance score (higher = more relevant to study group interests)
   */
  async calculateRelevanceScore(content: string): Promise<number> {
    if (!content || typeof content !== 'string') {
      return 0;
    }

    // Extract keywords from content
    const contentKeywords = extractKeywordsFromPost(content, undefined, {
      minLength: 2,
    });

    if (contentKeywords.length === 0) {
      return 0;
    }

    // Get all keywords from database
    const allKeywords = await this.db.select().from(keywords);
    
    if (allKeywords.length === 0) {
      return 0;
    }

    // Calculate total frequency for normalization
    const totalFrequency = allKeywords.reduce((sum, k) => sum + (k.frequency ?? 0), 0);
    
    if (totalFrequency === 0) {
      return 0;
    }

    // Create keyword frequency map
    const keywordMap = new Map<string, number>();
    for (const k of allKeywords) {
      keywordMap.set(k.keyword, k.frequency ?? 0);
    }

    // Calculate relevance score based on matching keywords
    let score = 0;
    for (const keyword of contentKeywords) {
      const frequency = keywordMap.get(keyword);
      if (frequency !== undefined && frequency > 0) {
        // Weight by normalized frequency
        score += frequency / totalFrequency;
      }
    }

    // Normalize score to 0-100 range
    // Multiply by 100 and cap at 100
    return Math.min(Math.round(score * 100 * 10), 100);
  }

  /**
   * Get all keywords
   * @returns Array of all keywords
   */
  async getAllKeywords(): Promise<Keyword[]> {
    return this.db.select().from(keywords);
  }

  /**
   * Get keyword by name
   * @param keyword Keyword string
   * @returns Keyword record or null
   */
  async getByKeyword(keyword: string): Promise<Keyword | null> {
    const [result] = await this.db
      .select()
      .from(keywords)
      .where(eq(keywords.keyword, keyword))
      .limit(1);

    return result || null;
  }

  /**
   * Process a new post and update keyword statistics
   * Combines extractKeywords and updateKeywordStats for convenience
   * @param title Post title
   * @param description Post description (optional)
   */
  async processPost(title: string, description?: string): Promise<string[]> {
    const extractedKeywords = this.extractKeywords(title, description);
    await this.updateKeywordStats(extractedKeywords);
    return extractedKeywords;
  }

  /**
   * Reset all keyword statistics (useful for recalculation)
   */
  async resetStats(): Promise<void> {
    await this.db.delete(keywords);
  }

  /**
   * Bulk update keywords with specific frequencies
   * Useful for testing and recalculation
   * @param keywordFrequencies Map of keyword to frequency
   */
  async bulkUpdateKeywords(keywordFrequencies: Map<string, number>): Promise<void> {
    for (const [keyword, frequency] of keywordFrequencies) {
      const [existing] = await this.db
        .select()
        .from(keywords)
        .where(eq(keywords.keyword, keyword))
        .limit(1);

      if (existing) {
        await this.db
          .update(keywords)
          .set({
            frequency,
            lastUpdated: new Date(),
          })
          .where(eq(keywords.keyword, keyword));
      } else {
        await this.db.insert(keywords).values({
          keyword,
          frequency,
          lastUpdated: new Date(),
        });
      }
    }
  }
}

// Singleton instance
let keywordServiceInstance: KeywordService | null = null;

/**
 * Get the KeywordService singleton instance
 */
export function getKeywordService(): KeywordService {
  if (!keywordServiceInstance) {
    keywordServiceInstance = new KeywordService();
  }
  return keywordServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetKeywordService(): void {
  keywordServiceInstance = null;
}
