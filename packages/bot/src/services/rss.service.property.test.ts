/**
 * Property-Based Tests for RSS Service
 * **Feature: blog-study-discord-bot**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  constructRssUrl,
  extractRssFromHtml,
  parseRssDate,
} from './rss.service';

describe('RSS Service Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 28: RSS URL Construction by Platform**
   * *For any* blog URL from known platforms (Velog, Tistory, Medium),
   * the RSS URL SHALL be correctly constructed using the platform-specific pattern.
   * **Validates: Requirements 11.1, 11.2, 11.3**
   */
  describe('Property 28: RSS URL Construction by Platform', () => {
    it('should construct correct RSS URL for Velog blogs', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[\w][\w-]{0,29}$/), // Valid username pattern
          (username) => {
            const blogUrl = `https://velog.io/@${username}`;
            const rssUrl = constructRssUrl(blogUrl, 'velog');
            
            expect(rssUrl).toBe(`https://v2.velog.io/rss/@${username}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should construct correct RSS URL for Tistory blogs', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[\w][\w-]{0,29}$/), // Valid blog name pattern
          (blogName) => {
            const blogUrl = `https://${blogName}.tistory.com`;
            const rssUrl = constructRssUrl(blogUrl, 'tistory');
            
            // URL hostnames are case-insensitive and normalized to lowercase
            expect(rssUrl).toBe(`https://${blogName.toLowerCase()}.tistory.com/rss`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should construct correct RSS URL for Medium blogs', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[\w][\w-]{0,29}$/), // Valid username pattern
          (username) => {
            const blogUrl = `https://medium.com/@${username}`;
            const rssUrl = constructRssUrl(blogUrl, 'medium');
            
            expect(rssUrl).toBe(`https://medium.com/feed/@${username}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for unknown platform', () => {
      fc.assert(
        fc.property(
          fc.webUrl().filter(url => 
            !url.includes('velog.io') && 
            !url.includes('tistory.com') && 
            !url.includes('medium.com')
          ),
          (url) => {
            const rssUrl = constructRssUrl(url, 'unknown');
            expect(rssUrl).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle trailing slashes in blog URLs', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[\w][\w-]{0,29}$/),
          fc.boolean(),
          (username, hasTrailingSlash) => {
            const blogUrl = `https://velog.io/@${username}${hasTrailingSlash ? '/' : ''}`;
            const rssUrl = constructRssUrl(blogUrl, 'velog');
            
            expect(rssUrl).toBe(`https://v2.velog.io/rss/@${username}`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 30: RSS Parsing Extraction**
   * *For any* valid RSS feed, parsing SHALL extract: title, link, published date,
   * and description from each item.
   * **Validates: Requirements 12.1**
   */
  describe('Property 30: RSS Parsing Extraction', () => {
    it('should extract RSS link from HTML with rss+xml type', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (rssUrl) => {
            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <link rel="alternate" type="application/rss+xml" href="${rssUrl}" />
              </head>
              <body></body>
              </html>
            `;
            
            const extracted = extractRssFromHtml(html);
            expect(extracted).toBe(rssUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract Atom feed link as fallback', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (atomUrl) => {
            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <link rel="alternate" type="application/atom+xml" href="${atomUrl}" />
              </head>
              <body></body>
              </html>
            `;
            
            const extracted = extractRssFromHtml(html);
            expect(extracted).toBe(atomUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when no RSS link is present', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (title) => {
            const html = `
              <!DOCTYPE html>
              <html>
              <head><title>${title}</title></head>
              <body></body>
              </html>
            `;
            
            const extracted = extractRssFromHtml(html);
            expect(extracted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 33: Date Format Parsing**
   * *For any* date string in RFC 822 or ISO 8601 format, parsing SHALL produce
   * a valid UTC timestamp.
   * **Validates: Requirements 12.5**
   */
  describe('Property 33: Date Format Parsing', () => {
    it('should parse ISO 8601 date strings', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            const isoString = date.toISOString();
            const parsed = parseRssDate(isoString);
            
            expect(parsed).not.toBeNull();
            expect(parsed!.getTime()).toBe(date.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse RFC 822 date strings', () => {
      // RFC 822 format: "Tue, 15 Nov 2024 12:45:26 GMT"
      const rfc822Dates = [
        'Tue, 15 Nov 2024 12:45:26 GMT',
        'Mon, 01 Jan 2024 00:00:00 +0000',
        'Fri, 31 Dec 2023 23:59:59 -0500',
        'Wed, 14 Feb 2024 08:30:00 +0900',
      ];

      rfc822Dates.forEach(dateStr => {
        const parsed = parseRssDate(dateStr);
        expect(parsed).not.toBeNull();
        expect(parsed).toBeInstanceOf(Date);
        expect(isNaN(parsed!.getTime())).toBe(false);
      });
    });

    it('should return null for invalid date strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            // Filter out strings that might accidentally be valid dates
            const d = new Date(s);
            return isNaN(d.getTime());
          }),
          (invalidDate) => {
            const parsed = parseRssDate(invalidDate);
            expect(parsed).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for undefined input', () => {
      expect(parseRssDate(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseRssDate('')).toBeNull();
    });
  });
});
