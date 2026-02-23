/**
 * Property-Based Tests for URL Validator
 * **Feature: blog-study-discord-bot, Property 2: Invalid URL Registration Rejection**
 * **Validates: Requirements 1.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidUrl, isValidBlogUrl, validateBlogUrl, detectBlogPlatform, normalizeUrl } from './url-validator';

describe('URL Validator Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 2: Invalid URL Registration Rejection**
   * *For any* string that does not match a valid URL pattern, attempting to register
   * SHALL be rejected without creating a Member record.
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Invalid URL Registration Rejection', () => {
    it('should reject all strings without http/https protocol', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.startsWith('http://') && !s.startsWith('https://')),
          (invalidUrl) => {
            expect(isValidUrl(invalidUrl)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject URLs with invalid protocols', () => {
      const invalidProtocols = ['ftp://', 'file://', 'mailto:', 'javascript:', 'data:'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...invalidProtocols),
          fc.webUrl().map(url => url.replace(/^https?:\/\//, '')),
          (protocol, urlPart) => {
            const invalidUrl = protocol + urlPart;
            expect(isValidUrl(invalidUrl)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject empty strings and whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
          (whitespace) => {
            expect(isValidUrl(whitespace)).toBe(false);
            expect(isValidBlogUrl(whitespace)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject null-like and non-string values', () => {
      const invalidValues = [null, undefined, '', '   '];
      invalidValues.forEach(value => {
        expect(isValidUrl(value as string)).toBe(false);
        expect(isValidBlogUrl(value as string)).toBe(false);
      });
    });

    it('should reject URLs without valid hostname', () => {
      const invalidUrls = [
        'http://',
        'https://',
        'http:///',
        'https:///',
        'http:// ',
        'https:// ',
      ];
      
      invalidUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(false);
      });
    });

    it('should reject malformed URLs', () => {
      // Note: URL constructor is lenient and normalizes some malformed URLs
      // e.g., 'http:example.com' becomes 'http://example.com/'
      // We only test URLs that are truly invalid
      const malformedUrls = [
        'not a url',
        'http//missing-colon.com',
        'https//missing-colon.com',
        '://no-protocol.com',
        'just-text',
        'www.example.com', // missing protocol
      ];

      malformedUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(false);
      });
    });
  });

  describe('Valid URL Acceptance', () => {
    it('should accept all valid http/https URLs', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (validUrl) => {
            expect(isValidUrl(validUrl)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid blog platform URLs', () => {
      const validBlogUrls = [
        'https://velog.io/@username',
        'https://velog.io/@user-name',
        'https://myblog.tistory.com',
        'https://my-blog.tistory.com',
        'https://medium.com/@username',
        'https://medium.com/@user-name',
      ];

      validBlogUrls.forEach(url => {
        expect(isValidBlogUrl(url)).toBe(true);
        const result = validateBlogUrl(url);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Platform Detection', () => {
    it('should correctly detect Velog URLs', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[\w-]+$/),
          (username) => {
            const url = `https://velog.io/@${username}`;
            if (isValidUrl(url)) {
              expect(detectBlogPlatform(url)).toBe('velog');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly detect Tistory URLs', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[\w-]+$/),
          (blogName) => {
            const url = `https://${blogName}.tistory.com`;
            if (isValidUrl(url)) {
              expect(detectBlogPlatform(url)).toBe('tistory');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly detect Medium URLs', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[\w-]+$/),
          (username) => {
            const url = `https://medium.com/@${username}`;
            if (isValidUrl(url)) {
              expect(detectBlogPlatform(url)).toBe('medium');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return unknown for other valid URLs', () => {
      fc.assert(
        fc.property(
          fc.webUrl().filter(url => 
            !url.includes('velog.io') && 
            !url.includes('tistory.com') && 
            !url.includes('medium.com')
          ),
          (url) => {
            expect(detectBlogPlatform(url)).toBe('unknown');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('URL Normalization', () => {
    it('should remove trailing slashes from valid URLs with paths', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.stringMatching(/^[\w-]+$/),
          (baseUrl, pathSegment) => {
            // Create a URL with a path and trailing slash
            const urlWithPath = `${baseUrl}/${pathSegment}/`;
            const normalized = normalizeUrl(urlWithPath);
            if (normalized) {
              // Normalized URL should not end with slash (except root)
              expect(normalized.endsWith('/')).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for invalid URLs', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.startsWith('http://') && !s.startsWith('https://')),
          (invalidUrl) => {
            expect(normalizeUrl(invalidUrl)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('validateBlogUrl comprehensive result', () => {
    it('should return complete validation result for valid URLs', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const result = validateBlogUrl(url);
            expect(result.isValid).toBe(true);
            expect(result.normalizedUrl).not.toBeNull();
            expect(['velog', 'tistory', 'medium', 'unknown']).toContain(result.platform);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error message for invalid URLs', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.startsWith('http://') && !s.startsWith('https://')),
          (invalidUrl) => {
            const result = validateBlogUrl(invalidUrl);
            expect(result.isValid).toBe(false);
            expect(result.normalizedUrl).toBeNull();
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
