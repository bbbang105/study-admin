/**
 * Curation Crawler Scheduler
 * 매일 09:00 크롤링, 10:00 공유
 * Requirements: 13.2, 13.6
 */

import {
  Client,
  EmbedBuilder,
  TextChannel,
  type MessageCreateOptions,
} from 'discord.js';
import { getCurationService, type CrawlResult, type CrawledContent } from '../services/curation.service';
import { getConfigValue, ConfigKeys } from '../services/round.service';
import { getKeywordService, type KeywordStat } from '../services/keyword.service';
import type { CurationItem, CurationSource } from '@blog-study/shared/db';

/**
 * Result of a curation cycle
 */
export interface CurationCycleResult {
  timestamp: Date;
  sourcesProcessed: number;
  totalNewItems: number;
  results: CrawlResult[];
  errors: string[];
}

/**
 * Result of sharing daily content
 */
export interface ShareResult {
  success: boolean;
  item: CurationItem | null;
  error?: string;
}

/**
 * Build curation content embed
 * Requirements: 13.7 - Include title, source, URL, category, and relevance reason
 */
export function buildCurationEmbed(
  item: CurationItem,
  source: CurationSource | null,
  topKeywords: string[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xFFA500) // Orange for curation
    .setTitle(`📚 ${item.title}`)
    .setURL(item.url)
    .setTimestamp();

  // Add source info
  if (source) {
    embed.setAuthor({
      name: source.name,
      url: source.url,
    });
  }

  // Add category
  const categoryEmoji = item.category === 'conference' ? '🎤' : '📰';
  embed.addFields({
    name: '카테고리',
    value: `${categoryEmoji} ${item.category === 'conference' ? '컨퍼런스' : '아티클'}`,
    inline: true,
  });

  // Add relevance score
  embed.addFields({
    name: '관련성 점수',
    value: `${Math.round(item.relevanceScore ?? 0)}점`,
    inline: true,
  });

  // Add tags if available
  if (item.tags && item.tags.length > 0) {
    embed.addFields({
      name: '태그',
      value: item.tags.slice(0, 5).map(t => `\`${t}\``).join(' '),
      inline: false,
    });
  }

  // Add relevance reason based on matching keywords
  if (topKeywords.length > 0) {
    const matchingKeywords = topKeywords.filter(keyword => {
      const titleLower = item.title.toLowerCase();
      const tagsLower = (item.tags || []).map(t => t.toLowerCase());
      return titleLower.includes(keyword.toLowerCase()) || 
             tagsLower.some(t => t.includes(keyword.toLowerCase()));
    });

    if (matchingKeywords.length > 0) {
      embed.addFields({
        name: '💡 추천 이유',
        value: `스터디원들의 관심 키워드와 일치: ${matchingKeywords.slice(0, 3).map(k => `\`${k}\``).join(', ')}`,
        inline: false,
      });
    }
  }

  // Add published date if available
  if (item.publishedAt) {
    embed.setFooter({
      text: `발행일: ${item.publishedAt.toLocaleDateString('ko-KR')}`,
    });
  }

  return embed;
}

/**
 * Build curation share message
 * Requirements: 13.6 - Send one curated content item per day
 */
export function buildCurationMessage(
  item: CurationItem,
  source: CurationSource | null,
  topKeywords: string[]
): MessageCreateOptions {
  return {
    content: '📢 **오늘의 추천 컨텐츠**가 도착했습니다! 🎉',
    embeds: [buildCurationEmbed(item, source, topKeywords)],
  };
}

/**
 * Curation Crawler class for scheduling content curation
 */
export class CurationCrawler {
  private client: Client | null = null;
  private isCrawling = false;
  private isSharing = false;
  private crawlFunction: ((url: string) => Promise<CrawledContent[]>) | null = null;

  /**
   * Set the Discord client for sending messages
   */
  setClient(client: Client): void {
    this.client = client;
  }

  /**
   * Set custom crawl function for sources
   * This allows injecting different crawling strategies
   */
  setCrawlFunction(fn: (url: string) => Promise<CrawledContent[]>): void {
    this.crawlFunction = fn;
  }

  /**
   * Check if currently crawling
   */
  isCrawlingNow(): boolean {
    return this.isCrawling;
  }

  /**
   * Check if currently sharing
   */
  isSharingNow(): boolean {
    return this.isSharing;
  }

  /**
   * Get the curation channel
   */
  async getCurationChannel(): Promise<TextChannel | null> {
    if (!this.client) {
      console.warn('[CurationCrawler] Discord client not set');
      return null;
    }

    const channelId = await getConfigValue(ConfigKeys.CURATION_CHANNEL);
    
    if (!channelId) {
      console.warn('[CurationCrawler] Curation channel not configured');
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel instanceof TextChannel) {
        return channel;
      }
      console.warn('[CurationCrawler] Curation channel is not a text channel');
      return null;
    } catch (error) {
      console.error('[CurationCrawler] Failed to fetch curation channel:', error);
      return null;
    }
  }

  /**
   * Run a crawling cycle for all active sources
   * Requirements: 13.2 - Crawl configured source websites once daily
   */
  async crawl(): Promise<CurationCycleResult> {
    if (this.isCrawling) {
      console.log('[CurationCrawler] Crawling already in progress, skipping');
      return {
        timestamp: new Date(),
        sourcesProcessed: 0,
        totalNewItems: 0,
        results: [],
        errors: ['Crawling already in progress'],
      };
    }

    this.isCrawling = true;
    const startTime = new Date();
    const errors: string[] = [];

    try {
      const curationService = getCurationService();
      const results = await curationService.crawlAllSources(this.crawlFunction || undefined);

      const totalNewItems = results.reduce((sum, r) => sum + r.newItemsAdded, 0);
      const failedResults = results.filter(r => !r.success);
      
      for (const failed of failedResults) {
        errors.push(`${failed.sourceName}: ${failed.error}`);
      }

      console.log(`[CurationCrawler] Completed - ${totalNewItems} new items from ${results.length} sources`);

      return {
        timestamp: startTime,
        sourcesProcessed: results.length,
        totalNewItems,
        results,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CurationCrawler] Crawl error: ${errorMessage}`);
      errors.push(errorMessage);

      return {
        timestamp: startTime,
        sourcesProcessed: 0,
        totalNewItems: 0,
        results: [],
        errors,
      };
    } finally {
      this.isCrawling = false;
    }
  }

  /**
   * Share daily curated content
   * Requirements: 13.6 - Send one curated content item per day at 10:00
   */
  async shareDailyContent(): Promise<ShareResult> {
    if (this.isSharing) {
      console.log('[CurationCrawler] Sharing already in progress, skipping');
      return {
        success: false,
        item: null,
        error: 'Sharing already in progress',
      };
    }

    this.isSharing = true;

    try {
      const channel = await this.getCurationChannel();
      
      if (!channel) {
        return {
          success: false,
          item: null,
          error: 'Curation channel not configured or not found',
        };
      }

      const curationService = getCurationService();
      const item = await curationService.selectDailyContent();

      if (!item) {
        console.log('[CurationCrawler] No unshared content available');
        return {
          success: false,
          item: null,
          error: 'No unshared content available',
        };
      }

      // Get source info
      let source: CurationSource | null = null;
      if (item.sourceId) {
        source = await curationService.getSourceById(item.sourceId);
      }

      // Get top keywords for relevance reason
      const keywordService = getKeywordService();
      const topKeywords = await keywordService.getTopKeywords(10);
      const keywordStrings = topKeywords.map((k: KeywordStat) => k.keyword);

      // Build and send message
      const message = buildCurationMessage(item, source, keywordStrings);
      await channel.send(message);

      // Mark as shared
      await curationService.markAsShared(item.id);

      console.log(`[CurationCrawler] Shared content: ${item.title}`);

      return {
        success: true,
        item,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CurationCrawler] Share error: ${errorMessage}`);

      return {
        success: false,
        item: null,
        error: errorMessage,
      };
    } finally {
      this.isSharing = false;
    }
  }
}

// Singleton instance
let curationCrawlerInstance: CurationCrawler | null = null;

/**
 * Get the CurationCrawler singleton instance
 */
export function getCurationCrawler(): CurationCrawler {
  if (!curationCrawlerInstance) {
    curationCrawlerInstance = new CurationCrawler();
  }
  return curationCrawlerInstance;
}

/**
 * Initialize the CurationCrawler with a Discord client
 */
export function initCurationCrawler(client: Client): CurationCrawler {
  const crawler = getCurationCrawler();
  crawler.setClient(client);
  return crawler;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetCurationCrawler(): void {
  curationCrawlerInstance = null;
}
