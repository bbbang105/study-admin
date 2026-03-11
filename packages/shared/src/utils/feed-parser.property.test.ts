/**
 * Feed Parser Utilities - Property-Based Tests
 * P1 #8: 큐레이션 데이터 품질 개선
 */

import { describe, it, expect } from 'vitest';
import { sanitizeDescription, extractFeedItems, extractOgImage } from './feed-parser';

describe('feed-parser utilities', () => {
  describe('sanitizeDescription', () => {
    it('Property 1: null 또는 undefined 입력은 null을 반환', () => {
      expect(sanitizeDescription(null)).toBeNull();
      expect(sanitizeDescription(undefined)).toBeNull();
    });

    it('Property 2: 빈 문자열은 null을 반환', () => {
      expect(sanitizeDescription('')).toBeNull();
      expect(sanitizeDescription('   ')).toBeNull();
    });

    it('Property 3: HTML 태그 제거', () => {
      const testCases = [
        '<p>Hello World</p>',
        '<div>Content</div>',
        '<span>Test</span>',
        '<a href="test">Link</a>',
      ];

      testCases.forEach((html) => {
        const result = sanitizeDescription(html);
        if (result !== null) {
          expect(result).not.toContain('<');
          expect(result).not.toContain('>');
        }
      });
    });

    it('Property 4: 제어 문자 제거 (0x00-0x1F)', () => {
      const controlChars = String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i));
      const input = `Hello${controlChars}World`;
      const result = sanitizeDescription(input);

      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\x01');
      expect(result).not.toContain('\x1F');
    });

    it('Property 5: 유니코드 제로 너비 문자 제거', () => {
      const input = 'Hello\u200BWorld\u200C\u200DTest';
      const result = sanitizeDescription(input);

      expect(result).not.toContain('\u200B');
      expect(result).not.toContain('\u200C');
      expect(result).not.toContain('\u200D');
    });

    it('Property 6: HTML 엔티티 디코딩', () => {
      expect(sanitizeDescription('Hello &amp; World')).toContain('Hello & World');
      expect(sanitizeDescription('1 &lt; 2')).toContain('1 < 2');
      expect(sanitizeDescription('&quot;quoted&quot;')).toContain('"quoted"');
      expect(sanitizeDescription('&#39;single&#39;')).toContain("'single'");
    });

    it('Property 7: 연속 공백 단일 공백으로 변환', () => {
      expect(sanitizeDescription('Hello    World')).toBe('Hello World');
      expect(sanitizeDescription('a  b   c    d')).toBe('a b c d');
    });

    it('Property 8: 앞뒤 공백 제거', () => {
      expect(sanitizeDescription('  Hello World  ')).toBe('Hello World');
      expect(sanitizeDescription('\tTest\n')).toBe('Test');
    });

    it('Property 9: 300자 초과시 축소 및 ... 추가', () => {
      const longText = 'a'.repeat(400);
      const result = sanitizeDescription(longText);

      expect(result).toBeTruthy();
      expect(result!.length).toBeLessThanOrEqual(304);
      expect(result?.endsWith('...')).toBe(true);
    });

    it('Property 10: 300자 이하는 ... 없이 반환', () => {
      const shortText = 'Hello World';
      const result = sanitizeDescription(shortText);

      expect(result).toBe(shortText);
      expect(result?.endsWith('...')).toBe(false);
    });

    it('Property 11: 복합 HTML 컨텐츠 처리', () => {
      const complexHtml = '<p>Hello <strong>&amp;</strong> World</p>';
      const result = sanitizeDescription(complexHtml);

      expect(result).toContain('Hello & World');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('Property 12: XSS 시도 차단', () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
      ];

      xssAttempts.forEach((attempt) => {
        const result = sanitizeDescription(attempt);
        if (result !== null) {
          // 스크립트 태그가 제거되어야 함
          expect(result).not.toContain('<script>');
          expect(result).not.toContain('<svg>');
          expect(result).not.toContain('onerror=');
          expect(result).not.toContain('onload=');
        }
      });
    });

    it('Property 13: 한국어 텍스트 보존', () => {
      const koreanText = '안녕하세요 세계!';
      const result = sanitizeDescription(koreanText);

      expect(result).toBe(koreanText);
    });

    it('Property 14: 이모지 보존', () => {
      const emojiText = 'Hello 👋 World 🌍 Test ✨';
      const result = sanitizeDescription(emojiText);

      expect(result).toContain('👋');
      expect(result).toContain('🌍');
      expect(result).toContain('✨');
    });

    it('Property 15: 개행 문자 공백으로 변환', () => {
      const newlines = 'Hello\n\n\nWorld\r\n\rTest';
      const result = sanitizeDescription(newlines);

      expect(result).not.toContain('\n');
      expect(result).not.toContain('\r');
      expect(result).toBe('Hello World Test');
    });

    it('Property 16: HTML 주석 제거', () => {
      const comment = 'Hello <!-- comment --> World';
      const result = sanitizeDescription(comment);

      expect(result).not.toContain('<!--');
      expect(result).not.toContain('-->');
    });
  });

  describe('extractFeedItems', () => {
    it('Property 1: 함수가 존재하고 export됨', () => {
      expect(typeof extractFeedItems).toBe('function');
    });
  });

  describe('extractOgImage', () => {
    it('Property 1: 함수가 존재하고 export됨', () => {
      expect(typeof extractOgImage).toBe('function');
    });

    it('Property 2: 내부 URL 차단 (SSRF 보호)', async () => {
      const unsafeUrls = [
        'http://localhost:8080',
        'http://127.0.0.1',
        'http://169.254.169.254',
        'http://10.0.0.1',
        'http://192.168.1.1',
      ];

      for (const url of unsafeUrls) {
        const result = await extractOgImage(url);
        expect(result).toBeNull();
      }
    });

    it('Property 3: 유효하지 않은 URL은 null 반환', async () => {
      const result = await extractOgImage('not-a-url');
      expect(result).toBeNull();
    });
  });

  describe('extractFeedItems 포맷별 동작', () => {
    it('Property 17: RSS 포맷 파싱', () => {
      const mockResult = {
        format: 'rss' as const,
        feed: {
          items: [
            {
              title: 'Test Post',
              link: 'https://example.com/post1',
              pubDate: new Date('2026-03-01'),
              description: '<pTest description</p>',
              categories: ['tech', 'programming'],
            },
          ],
        },
      };

      const items = extractFeedItems(mockResult);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        title: 'Test Post',
        link: 'https://example.com/post1',
        description: '<pTest description</p>',
        categories: ['tech', 'programming'],
      });
    });

    it('Property 18: Atom 포맷 파싱', () => {
      const mockResult = {
        format: 'atom' as const,
        feed: {
          entries: [
            {
              title: 'Atom Post',
              links: [{ href: 'https://example.com/atom1' }],
              published: '2026-03-01T00:00:00Z',
              summary: 'Atom summary',
              categories: [{ term: 'blog' }],
            },
          ],
        },
      };

      const items = extractFeedItems(mockResult);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        title: 'Atom Post',
        link: 'https://example.com/atom1',
        description: 'Atom summary',
        categories: ['blog'],
      });
    });

    it('Property 19: JSON Feed 포맷 파싱', () => {
      const mockResult = {
        format: 'json' as const,
        feed: {
          items: [
            {
              title: 'JSON Feed Post',
              url: 'https://example.com/json1',
              date_published: '2026-03-01T00:00:00Z',
              summary: 'JSON feed summary',
              tags: ['javascript', 'nodejs'],
            },
          ],
        },
      };

      const items = extractFeedItems(mockResult);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        title: 'JSON Feed Post',
        link: 'https://example.com/json1',
        description: 'JSON feed summary',
        categories: ['javascript', 'nodejs'],
      });
    });

    it('Property 20: RDF 포맷 파싱 (fallback)', () => {
      const mockResult = {
        format: 'rdf' as const,
        feed: {
          items: [
            {
              title: 'RDF Post',
              link: 'https://example.com/rdf1',
              dc: { date: '2026-03-01T00:00:00Z' },
              description: 'RDF description',
            },
          ],
        },
      };

      const items = extractFeedItems(mockResult);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        title: 'RDF Post',
        link: 'https://example.com/rdf1',
        description: 'RDF description',
      });
    });
  });
});
