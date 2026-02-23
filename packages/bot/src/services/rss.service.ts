/**
 * RSS Service
 * RSS URL 감지, 피드 파싱, 폴링 서비스
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 12.5, 6.1, 6.2
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { detectBlogPlatform, type BlogPlatform } from '@blog-study/shared/utils';

/**
 * Error codes for RSS operations
 */
export const RssErrorCodes = {
  RSS_FETCH_FAILED: 'E3001',
  RSS_PARSE_FAILED: 'E3002',
  RSS_DETECTION_FAILED: 'E3003',
} as const;

/**
 * Custom error class for RSS operations
 */
export class RssError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    message?: string
  ) {
    super(message || userMessage);
    this.name = 'RssError';
  }
}

/**
 * RSS feed item extracted from a feed
 */
export interface RssFeedItem {
  title: string;
  link: string;
  pubDate: Date;
  description: string | null;
}

/**
 * Result of RSS URL detection
 */
export interface RssDetectionResult {
  success: boolean;
  rssUrl: string | null;
  platform: BlogPlatform;
  error?: string;
}

/**
 * Result of polling a single member's RSS feed
 */
export interface PollResult {
  memberId: string;
  success: boolean;
  newItems: RssFeedItem[];
  error?: string;
}

/**
 * Construct RSS URL for known blog platforms
 * Requirements: 11.1, 11.2, 11.3
 * 
 * @param blogUrl - The blog URL
 * @param platform - The detected platform
 * @returns RSS URL or null if cannot be constructed
 */
export function constructRssUrl(blogUrl: string, platform: BlogPlatform): string | null {
  try {
    const url = new URL(blogUrl);
    
    switch (platform) {
      case 'velog': {
        // Velog: https://velog.io/@username -> https://v2.velog.io/rss/@username
        const match = url.pathname.match(/^\/@([\w-]+)\/?$/);
        if (match) {
          return `https://v2.velog.io/rss/@${match[1]}`;
        }
        return null;
      }
      
      case 'tistory': {
        // Tistory: https://blog.tistory.com -> https://blog.tistory.com/rss
        return `${url.protocol}//${url.hostname}/rss`;
      }
      
      case 'medium': {
        // Medium: https://medium.com/@username -> https://medium.com/feed/@username
        const match = url.pathname.match(/^\/@([\w-]+)\/?$/);
        if (match) {
          return `https://medium.com/feed/@${match[1]}`;
        }
        return null;
      }
      
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Extract RSS URL from HTML page by looking for link tags
 * Requirements: 11.4
 * 
 * @param html - The HTML content of the page
 * @returns RSS URL or null if not found
 */
export function extractRssFromHtml(html: string): string | null {
  try {
    const $ = cheerio.load(html);
    
    // Look for RSS link tags
    const rssLink = $('link[type="application/rss+xml"]').attr('href');
    if (rssLink) {
      return rssLink;
    }
    
    // Also try atom feeds
    const atomLink = $('link[type="application/atom+xml"]').attr('href');
    if (atomLink) {
      return atomLink;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse date string from RSS feed
 * Handles RFC 822 and ISO 8601 formats
 * Requirements: 12.5
 * 
 * @param dateStr - The date string to parse
 * @returns Date object or null if parsing fails
 */
export function parseRssDate(dateStr: string | undefined): Date | null {
  if (!dateStr) {
    return null;
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

/**
 * RSS Service class for managing RSS operations
 */
export class RssService {
  private parser: Parser;
  private httpTimeout = 10000; // 10 seconds

  constructor() {
    this.parser = new Parser({
      timeout: this.httpTimeout,
      headers: {
        'User-Agent': 'BlogStudyBot/1.0',
      },
    });
  }

  /**
   * Detect RSS URL from a blog URL
   * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
   * 
   * @param blogUrl - The blog URL to detect RSS from
   * @returns Detection result with RSS URL or error
   */
  async detectRssUrl(blogUrl: string): Promise<RssDetectionResult> {
    const platform = detectBlogPlatform(blogUrl);
    
    // Try platform-specific construction first
    if (platform !== 'unknown') {
      const rssUrl = constructRssUrl(blogUrl, platform);
      if (rssUrl) {
        // Verify the RSS URL is valid by trying to fetch it
        try {
          await this.parser.parseURL(rssUrl);
          return { success: true, rssUrl, platform };
        } catch {
          // Fall through to HTML discovery
        }
      }
    }

    // Try to discover RSS from HTML link tags
    try {
      const response = await axios.get(blogUrl, {
        timeout: this.httpTimeout,
        headers: {
          'User-Agent': 'BlogStudyBot/1.0',
        },
      });
      
      const rssUrl = extractRssFromHtml(response.data);
      if (rssUrl) {
        // Make absolute URL if relative
        const absoluteRssUrl = new URL(rssUrl, blogUrl).toString();
        
        // Verify the RSS URL is valid
        try {
          await this.parser.parseURL(absoluteRssUrl);
          return { success: true, rssUrl: absoluteRssUrl, platform };
        } catch {
          return {
            success: false,
            rssUrl: null,
            platform,
            error: 'RSS 피드를 파싱할 수 없습니다.',
          };
        }
      }
    } catch {
      // Could not fetch the blog page
    }

    return {
      success: false,
      rssUrl: null,
      platform,
      error: 'RSS URL을 감지할 수 없습니다. /참가 [블로그URL] [RSS_URL] 형식으로 직접 입력해주세요.',
    };
  }

  /**
   * Fetch and parse an RSS feed
   * Requirements: 12.1, 12.2
   * 
   * @param rssUrl - The RSS feed URL to fetch
   * @returns Array of feed items
   * @throws RssError if fetch or parse fails
   */
  async fetchFeed(rssUrl: string): Promise<RssFeedItem[]> {
    try {
      const feed = await this.parser.parseURL(rssUrl);
      const items: RssFeedItem[] = [];

      for (const item of feed.items) {
        // Skip items missing required fields (title or link)
        // Requirements: 12.2
        if (!item.title || !item.link) {
          continue;
        }

        const pubDate = parseRssDate(item.pubDate || item.isoDate);
        
        items.push({
          title: item.title,
          link: item.link,
          pubDate: pubDate || new Date(),
          description: item.contentSnippet || item.content || null,
        });
      }

      return items;
    } catch (error) {
      throw new RssError(
        RssErrorCodes.RSS_FETCH_FAILED,
        'RSS 피드를 가져올 수 없습니다.',
        `Failed to fetch RSS feed: ${rssUrl} - ${error}`
      );
    }
  }
}

// Singleton instance
let rssServiceInstance: RssService | null = null;

/**
 * Get the RssService singleton instance
 */
export function getRssService(): RssService {
  if (!rssServiceInstance) {
    rssServiceInstance = new RssService();
  }
  return rssServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetRssService(): void {
  rssServiceInstance = null;
}
