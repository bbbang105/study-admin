/**
 * Property-Based Tests for Keyword Extractor
 * **Feature: blog-study-discord-bot, Property 37: Keyword Extraction**
 * **Validates: Requirements 14.1, 14.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  extractKeywords,
  extractKeywordsFromPost,
  extractKeywordsFromMultiple,
  normalizeText,
  normalizeKeyword,
  isStopWord,
  getKoreanStopWords,
  getEnglishStopWords,
} from './keyword-extractor';

describe('Keyword Extractor Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 37: Keyword Extraction**
   * *For any* post title and description, keyword extraction SHALL produce a list
   * of normalized keywords with stop words filtered out.
   * **Validates: Requirements 14.1, 14.6**
   */
  describe('Property 37: Keyword Extraction', () => {
    it('should filter out all Korean stop words from extracted keywords', () => {
      const koreanStopWords = getKoreanStopWords();
      
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...koreanStopWords), { minLength: 1, maxLength: 10 }),
          fc.array(fc.stringMatching(/^[가-힣]{2,10}$/), { minLength: 1, maxLength: 5 }),
          (stopWords, validWords) => {
            // Create text with mix of stop words and valid words
            const text = [...stopWords, ...validWords].join(' ');
            const keywords = extractKeywords(text);
            
            // No stop words should be in the result
            for (const keyword of keywords) {
              expect(koreanStopWords.has(keyword)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter out all English stop words from extracted keywords', () => {
      const englishStopWords = getEnglishStopWords();
      
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...englishStopWords), { minLength: 1, maxLength: 10 }),
          fc.array(fc.stringMatching(/^[a-z]{3,10}$/), { minLength: 1, maxLength: 5 }),
          (stopWords, validWords) => {
            // Create text with mix of stop words and valid words
            const text = [...stopWords, ...validWords].join(' ');
            const keywords = extractKeywords(text);
            
            // No stop words should be in the result
            for (const keyword of keywords) {
              expect(englishStopWords.has(keyword)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should normalize all extracted keywords to lowercase', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.stringMatching(/^[A-Za-z]{3,10}$/),
            { minLength: 1, maxLength: 10 }
          ),
          (words) => {
            const text = words.join(' ');
            const keywords = extractKeywords(text);
            
            // All keywords should be lowercase
            for (const keyword of keywords) {
              expect(keyword).toBe(keyword.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove duplicate keywords', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{3,10}$/),
          fc.integer({ min: 2, max: 10 }),
          (word, repeatCount) => {
            // Create text with repeated word
            const text = Array(repeatCount).fill(word).join(' ');
            const keywords = extractKeywords(text);
            
            // Should have at most one instance of the word
            const wordCount = keywords.filter(k => k === word).length;
            expect(wordCount).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter out words shorter than minimum length', () => {
      const minLength = 3;
      
      fc.assert(
        fc.property(
          fc.array(
            fc.stringMatching(/^[a-z]{1,10}$/),
            { minLength: 1, maxLength: 20 }
          ),
          (words) => {
            const text = words.join(' ');
            const keywords = extractKeywords(text, { minLength });
            
            // All keywords should meet minimum length
            for (const keyword of keywords) {
              expect(keyword.length).toBeGreaterThanOrEqual(minLength);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter out pure numeric strings by default', () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^\d{1,10}$/), { minLength: 1, maxLength: 5 }),
          fc.array(fc.stringMatching(/^[a-z]{3,10}$/), { minLength: 1, maxLength: 5 }),
          (numbers, words) => {
            const text = [...numbers, ...words].join(' ');
            const keywords = extractKeywords(text, { includeNumbers: false });
            
            // No pure numeric keywords should be in the result
            for (const keyword of keywords) {
              expect(/^\d+$/.test(keyword)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include numeric strings when includeNumbers is true', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^\d{3,10}$/),
          (number) => {
            const keywords = extractKeywords(number, { includeNumbers: true, minLength: 1 });
            
            // The number should be included
            expect(keywords).toContain(number);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract keywords from post title and description', () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^[a-z]{3,10}$/), { minLength: 1, maxLength: 5 }),
          fc.array(fc.stringMatching(/^[a-z]{3,10}$/), { minLength: 1, maxLength: 5 }),
          (titleWords, descWords) => {
            const title = titleWords.join(' ');
            const description = descWords.join(' ');
            const keywords = extractKeywordsFromPost(title, description);
            
            // Keywords should be from both title and description
            const allWords = new Set([...titleWords, ...descWords]);
            for (const keyword of keywords) {
              // Each keyword should be from the original words (after filtering)
              if (!isStopWord(keyword) && keyword.length >= 2) {
                expect(allWords.has(keyword)).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect maxKeywords limit', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.stringMatching(/^[a-z]{3,10}$/),
            { minLength: 10, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 5 }),
          (words, maxKeywords) => {
            const text = words.join(' ');
            const keywords = extractKeywords(text, { maxKeywords });
            
            expect(keywords.length).toBeLessThanOrEqual(maxKeywords);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle custom stop words', () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^[a-z]{3,10}$/), { minLength: 3, maxLength: 10 }),
          (words) => {
            // Use first word as custom stop word (guaranteed to exist due to minLength: 3)
            const customStopWord = words[0] as string;
            const text = words.join(' ');
            const keywords = extractKeywords(text, { customStopWords: [customStopWord] });
            
            // Custom stop word should not be in results
            expect(keywords).not.toContain(customStopWord);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Text Normalization', () => {
    it('should convert all text to lowercase', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (text) => {
            const normalized = normalizeText(text);
            expect(normalized).toBe(normalized.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove HTML tags', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]+$/),
          fc.stringMatching(/^[a-z]+$/),
          (tagName, content) => {
            const html = `<${tagName}>${content}</${tagName}>`;
            const normalized = normalizeText(html);
            
            // Should not contain angle brackets
            expect(normalized).not.toContain('<');
            expect(normalized).not.toContain('>');
            // Should contain the content
            expect(normalized).toContain(content);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove URLs from text', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.stringMatching(/^[a-z]{3,10}$/),
          (url, word) => {
            const text = `${word} ${url} ${word}`;
            const normalized = normalizeText(text);
            
            // Should not contain http or https
            expect(normalized).not.toContain('http');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty string for null/undefined/empty input', () => {
      expect(normalizeText('')).toBe('');
      expect(normalizeText(null as unknown as string)).toBe('');
      expect(normalizeText(undefined as unknown as string)).toBe('');
    });
  });

  describe('Keyword Normalization', () => {
    it('should trim whitespace from keywords', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{3,10}$/),
          fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 3 }),
          (word, whitespace) => {
            const paddedWord = whitespace + word + whitespace;
            const normalized = normalizeKeyword(paddedWord);
            
            expect(normalized).toBe(word);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should convert keywords to lowercase', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z]{3,10}$/),
          (upperWord) => {
            const normalized = normalizeKeyword(upperWord);
            expect(normalized).toBe(upperWord.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Stop Word Detection', () => {
    it('should identify all Korean stop words', () => {
      const koreanStopWords = getKoreanStopWords();
      
      for (const stopWord of koreanStopWords) {
        expect(isStopWord(stopWord)).toBe(true);
      }
    });

    it('should identify all English stop words', () => {
      const englishStopWords = getEnglishStopWords();
      
      for (const stopWord of englishStopWords) {
        expect(isStopWord(stopWord)).toBe(true);
      }
    });

    it('should be case-insensitive for stop word detection', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...getEnglishStopWords()),
          (stopWord) => {
            expect(isStopWord(stopWord.toUpperCase())).toBe(true);
            expect(isStopWord(stopWord.toLowerCase())).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple Text Extraction', () => {
    it('should merge keywords from multiple texts without duplicates', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.array(fc.stringMatching(/^[a-z]{3,10}$/), { minLength: 1, maxLength: 5 }),
            { minLength: 2, maxLength: 5 }
          ),
          (textArrays) => {
            const texts = textArrays.map(words => words.join(' '));
            const keywords = extractKeywordsFromMultiple(texts);
            
            // No duplicates
            const uniqueKeywords = new Set(keywords);
            expect(keywords.length).toBe(uniqueKeywords.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for empty input', () => {
      expect(extractKeywordsFromMultiple([])).toEqual([]);
      expect(extractKeywordsFromMultiple(['', '  ', '\n'])).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(extractKeywords('')).toEqual([]);
      expect(extractKeywords('   ')).toEqual([]);
      expect(extractKeywords('\n\t')).toEqual([]);
    });

    it('should handle text with only stop words', () => {
      const stopWordsText = 'the and or but if then';
      const keywords = extractKeywords(stopWordsText);
      expect(keywords).toEqual([]);
    });

    it('should handle text with only short words', () => {
      const shortWordsText = 'a b c d e f';
      const keywords = extractKeywords(shortWordsText, { minLength: 2 });
      expect(keywords).toEqual([]);
    });

    it('should handle Korean text', () => {
      const koreanText = '프로그래밍 자바스크립트 타입스크립트 개발';
      const keywords = extractKeywords(koreanText);
      
      // Should extract Korean keywords
      expect(keywords.length).toBeGreaterThan(0);
      // Should not contain Korean stop words
      const koreanStopWords = getKoreanStopWords();
      for (const keyword of keywords) {
        expect(koreanStopWords.has(keyword)).toBe(false);
      }
    });

    it('should handle mixed Korean and English text', () => {
      const mixedText = 'React 컴포넌트 TypeScript 타입 시스템';
      const keywords = extractKeywords(mixedText);
      
      expect(keywords.length).toBeGreaterThan(0);
    });
  });
});
