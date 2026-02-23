/**
 * Property-Based Tests for KeywordService
 * Tests correctness properties for keyword management operations
 * 
 * These tests verify the business logic of keyword operations using
 * pure functions extracted from the service.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractKeywordsFromPost, extractKeywords } from '@blog-study/shared/utils';

/**
 * Generate valid keyword strings (lowercase, no stop words, min length 2)
 */
const validKeywordArb = fc.stringMatching(/^[a-z]{3,15}$/).filter(
  (s) => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out'].includes(s)
);

/**
 * Generate valid post titles
 */
const postTitleArb = fc.array(validKeywordArb, { minLength: 2, maxLength: 8 })
  .map(words => words.join(' '));

/**
 * Generate valid post descriptions
 */
const postDescriptionArb = fc.array(validKeywordArb, { minLength: 3, maxLength: 15 })
  .map(words => words.join(' '));

// ============================================
// Pure Business Logic Functions for Testing
// ============================================

/**
 * Simulate keyword frequency aggregation
 * This is a pure function that mimics the database aggregation logic
 */
function aggregateKeywordFrequencies(
  keywordLists: string[][]
): Map<string, number> {
  const frequencyMap = new Map<string, number>();
  
  for (const keywords of keywordLists) {
    // Deduplicate within each list (as the service does)
    const uniqueKeywords = [...new Set(keywords)];
    
    for (const keyword of uniqueKeywords) {
      const current = frequencyMap.get(keyword) || 0;
      frequencyMap.set(keyword, current + 1);
    }
  }
  
  return frequencyMap;
}

/**
 * Get top N keywords from frequency map
 */
function getTopKeywordsFromMap(
  frequencyMap: Map<string, number>,
  limit: number
): Array<{ keyword: string; frequency: number }> {
  const entries = Array.from(frequencyMap.entries())
    .map(([keyword, frequency]) => ({ keyword, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
  
  return entries;
}

/**
 * Calculate relevance score based on keyword matches
 */
function calculateRelevanceScorePure(
  contentKeywords: string[],
  keywordFrequencies: Map<string, number>
): number {
  if (contentKeywords.length === 0 || keywordFrequencies.size === 0) {
    return 0;
  }

  const totalFrequency = Array.from(keywordFrequencies.values())
    .reduce((sum, freq) => sum + freq, 0);
  
  if (totalFrequency === 0) {
    return 0;
  }

  let score = 0;
  for (const keyword of contentKeywords) {
    const frequency = keywordFrequencies.get(keyword);
    if (frequency !== undefined && frequency > 0) {
      score += frequency / totalFrequency;
    }
  }

  return Math.min(Math.round(score * 100 * 10), 100);
}

// ============================================
// Property Tests
// ============================================

describe('KeywordService Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 38: Keyword Frequency Aggregation**
   * *For any* set of extracted keywords, the frequency table SHALL correctly
   * aggregate counts across all posts.
   * **Validates: Requirements 14.2**
   */
  describe('Property 38: Keyword Frequency Aggregation', () => {
    it('should correctly count keyword occurrences across multiple posts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.array(validKeywordArb, { minLength: 1, maxLength: 10 }),
            { minLength: 1, maxLength: 20 }
          ),
          (keywordLists) => {
            const frequencyMap = aggregateKeywordFrequencies(keywordLists);
            
            // Verify each keyword's frequency
            for (const [keyword, frequency] of frequencyMap) {
              // Count how many lists contain this keyword
              const expectedCount = keywordLists.filter(
                list => list.includes(keyword)
              ).length;
              
              expect(frequency).toBe(expectedCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should deduplicate keywords within a single post', () => {
      fc.assert(
        fc.property(
          validKeywordArb,
          fc.integer({ min: 2, max: 10 }),
          (keyword, repeatCount) => {
            // Create a list with repeated keyword
            const repeatedKeywords = Array(repeatCount).fill(keyword);
            const frequencyMap = aggregateKeywordFrequencies([repeatedKeywords]);
            
            // Should only count once per post
            expect(frequencyMap.get(keyword)).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should increment frequency for each post containing the keyword', () => {
      fc.assert(
        fc.property(
          validKeywordArb,
          fc.integer({ min: 1, max: 20 }),
          (keyword, postCount) => {
            // Create multiple posts each containing the keyword
            const keywordLists = Array(postCount).fill([keyword]);
            const frequencyMap = aggregateKeywordFrequencies(keywordLists);
            
            expect(frequencyMap.get(keyword)).toBe(postCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty keyword lists', () => {
      const frequencyMap = aggregateKeywordFrequencies([]);
      expect(frequencyMap.size).toBe(0);
      
      const frequencyMap2 = aggregateKeywordFrequencies([[], [], []]);
      expect(frequencyMap2.size).toBe(0);
    });

    it('should preserve all unique keywords across posts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.array(validKeywordArb, { minLength: 1, maxLength: 5 }),
            { minLength: 1, maxLength: 10 }
          ),
          (keywordLists) => {
            const frequencyMap = aggregateKeywordFrequencies(keywordLists);
            
            // All unique keywords should be in the map
            const allKeywords = new Set(keywordLists.flat());
            for (const keyword of allKeywords) {
              expect(frequencyMap.has(keyword)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 39: Top Keywords Ranking**
   * *For any* `/관심분야` command, the response SHALL display top 10 keywords
   * sorted by frequency in descending order.
   * **Validates: Requirements 14.3**
   */
  describe('Property 39: Top Keywords Ranking', () => {
    it('should return keywords sorted by frequency in descending order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(validKeywordArb, fc.integer({ min: 1, max: 100 })),
            { minLength: 1, maxLength: 30 }
          ),
          (keywordFreqPairs) => {
            // Create frequency map from pairs (deduplicate keywords)
            const frequencyMap = new Map<string, number>();
            for (const [keyword, freq] of keywordFreqPairs) {
              if (!frequencyMap.has(keyword)) {
                frequencyMap.set(keyword, freq);
              }
            }
            
            const topKeywords = getTopKeywordsFromMap(frequencyMap, 10);
            
            // Verify descending order
            for (let i = 1; i < topKeywords.length; i++) {
              expect(topKeywords[i - 1]!.frequency).toBeGreaterThanOrEqual(
                topKeywords[i]!.frequency
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return at most 10 keywords', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(validKeywordArb, fc.integer({ min: 1, max: 100 })),
            { minLength: 15, maxLength: 50 }
          ),
          (keywordFreqPairs) => {
            // Create frequency map from pairs (deduplicate keywords)
            const frequencyMap = new Map<string, number>();
            for (const [keyword, freq] of keywordFreqPairs) {
              if (!frequencyMap.has(keyword)) {
                frequencyMap.set(keyword, freq);
              }
            }
            
            const topKeywords = getTopKeywordsFromMap(frequencyMap, 10);
            
            expect(topKeywords.length).toBeLessThanOrEqual(10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all keywords if less than limit', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(validKeywordArb, fc.integer({ min: 1, max: 100 })),
            { minLength: 1, maxLength: 5 }
          ),
          (keywordFreqPairs) => {
            // Create frequency map from pairs (deduplicate keywords)
            const frequencyMap = new Map<string, number>();
            for (const [keyword, freq] of keywordFreqPairs) {
              if (!frequencyMap.has(keyword)) {
                frequencyMap.set(keyword, freq);
              }
            }
            
            const topKeywords = getTopKeywordsFromMap(frequencyMap, 10);
            
            expect(topKeywords.length).toBe(frequencyMap.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include the highest frequency keywords', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(validKeywordArb, fc.integer({ min: 1, max: 100 })),
            { minLength: 15, maxLength: 30 }
          ),
          (keywordFreqPairs) => {
            // Create frequency map from pairs (deduplicate keywords)
            const frequencyMap = new Map<string, number>();
            for (const [keyword, freq] of keywordFreqPairs) {
              if (!frequencyMap.has(keyword)) {
                frequencyMap.set(keyword, freq);
              }
            }
            
            const topKeywords = getTopKeywordsFromMap(frequencyMap, 10);
            
            if (topKeywords.length === 0) return;
            
            // The minimum frequency in top 10 should be >= any frequency not in top 10
            const minTopFreq = Math.min(...topKeywords.map(k => k.frequency));
            const topKeywordSet = new Set(topKeywords.map(k => k.keyword));
            
            for (const [keyword, freq] of frequencyMap) {
              if (!topKeywordSet.has(keyword)) {
                expect(freq).toBeLessThanOrEqual(minTopFreq);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty frequency map', () => {
      const topKeywords = getTopKeywordsFromMap(new Map(), 10);
      expect(topKeywords).toEqual([]);
    });
  });

  /**
   * Additional tests for keyword extraction integration
   */
  describe('Keyword Extraction Integration', () => {
    it('should extract keywords from post title and description', () => {
      fc.assert(
        fc.property(
          postTitleArb,
          postDescriptionArb,
          (title, description) => {
            const keywords = extractKeywordsFromPost(title, description);
            
            // Should return an array
            expect(Array.isArray(keywords)).toBe(true);
            
            // All keywords should be lowercase
            for (const keyword of keywords) {
              expect(keyword).toBe(keyword.toLowerCase());
            }
            
            // No duplicates
            const uniqueKeywords = new Set(keywords);
            expect(keywords.length).toBe(uniqueKeywords.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter out stop words from extracted keywords', () => {
      const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all'];
      
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...stopWords), { minLength: 1, maxLength: 5 }),
          fc.array(validKeywordArb, { minLength: 1, maxLength: 5 }),
          (stops, validWords) => {
            const text = [...stops, ...validWords].join(' ');
            const keywords = extractKeywords(text);
            
            // No stop words should be in the result
            for (const keyword of keywords) {
              expect(stopWords).not.toContain(keyword);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Relevance Score Calculation Tests
   */
  describe('Relevance Score Calculation', () => {
    it('should return 0 for empty content keywords', () => {
      const frequencyMap = new Map([['test', 5], ['keyword', 3]]);
      const score = calculateRelevanceScorePure([], frequencyMap);
      expect(score).toBe(0);
    });

    it('should return 0 for empty frequency map', () => {
      const score = calculateRelevanceScorePure(['test', 'keyword'], new Map());
      expect(score).toBe(0);
    });

    it('should return higher score for more matching keywords', () => {
      fc.assert(
        fc.property(
          fc.array(validKeywordArb, { minLength: 3, maxLength: 10 }),
          (keywords) => {
            // Create frequency map with all keywords having same frequency
            const frequencyMap = new Map<string, number>();
            for (const keyword of keywords) {
              frequencyMap.set(keyword, 10);
            }
            
            // Score with 1 matching keyword
            const score1 = calculateRelevanceScorePure([keywords[0]!], frequencyMap);
            
            // Score with 2 matching keywords
            const score2 = calculateRelevanceScorePure(
              [keywords[0]!, keywords[1]!],
              frequencyMap
            );
            
            // More matches should give higher or equal score
            expect(score2).toBeGreaterThanOrEqual(score1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 for non-matching keywords', () => {
      fc.assert(
        fc.property(
          fc.array(validKeywordArb, { minLength: 2, maxLength: 5 }),
          fc.array(validKeywordArb, { minLength: 2, maxLength: 5 }),
          (contentKeywords, mapKeywords) => {
            // Ensure no overlap
            const contentSet = new Set(contentKeywords);
            const nonOverlappingMapKeywords = mapKeywords.filter(k => !contentSet.has(k));
            
            if (nonOverlappingMapKeywords.length === 0) return; // Skip if all overlap
            
            const frequencyMap = new Map<string, number>();
            for (const keyword of nonOverlappingMapKeywords) {
              frequencyMap.set(keyword, 10);
            }
            
            const score = calculateRelevanceScorePure(contentKeywords, frequencyMap);
            expect(score).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cap score at 100', () => {
      fc.assert(
        fc.property(
          fc.array(validKeywordArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 1000 }),
          (keywords, frequency) => {
            const frequencyMap = new Map<string, number>();
            for (const keyword of keywords) {
              frequencyMap.set(keyword, frequency);
            }
            
            const score = calculateRelevanceScorePure(keywords, frequencyMap);
            expect(score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
