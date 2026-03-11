/**
 * Feed Parser Utilities
 * RSS/Atom/JSON 피드 파싱 및 HTML 컨텐츠 추출
 * P1 #8: 큐레이션 봇 크롤러 데이터 품질 개선을 위한 공유 유틸리티
 */

import { parseFeed } from 'feedsmith';
import { decode } from 'html-entities';
import { isSafeUrl } from './url-validator';

/**
 * Normalized feed item structure
 */
export interface NormalizedFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  categories?: string[];
}

/**
 * Normalize feed items across different formats (RSS/Atom/JSON/RDF)
 */
export function extractFeedItems(result: ReturnType<typeof parseFeed>): NormalizedFeedItem[] {
  const { format, feed } = result;

  if (format === 'atom') {
    return (feed.entries ?? []).map((entry) => ({
      title: entry.title,
      link: entry.links?.[0]?.href,
      pubDate: entry.published ?? entry.updated,
      description: entry.summary ?? entry.content,
      categories: entry.categories?.map((c) => c.term).filter(Boolean) as string[],
    }));
  }

  if (format === 'rss') {
    return (feed.items ?? []).map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate ? String(item.pubDate) : undefined,
      description: item.description,
      categories: item.categories
        ?.map((c) => (typeof c === 'string' ? c : c.name))
        .filter(Boolean) as string[],
    }));
  }

  if (format === 'json') {
    return (feed.items ?? []).map((item) => ({
      title: item.title,
      link: item.url ?? item.external_url,
      pubDate: item.date_published ?? item.date_modified,
      description: item.summary ?? item.content_text,
      categories: item.tags,
    }));
  }

  // RDF
  return (feed.items ?? []).map((item) => ({
    title: item.title,
    link: item.link,
    pubDate: item.dc?.date,
    description: item.description,
  }));
}

/**
 * HTML 태그 제거 + HTML 엔티티 디코딩 + 보안 위험 요소 제거 + 300자 truncate
 * - 제어 문자 제어 (0x00-0x1F)
 * - 제로 너비 / 방향 제어 유니코드 제거
 * - HTML 엔티티 디코딩 (&amp;, &lt;, 등)
 */
export function sanitizeDescription(html: string | undefined): string | null {
  if (!html) return null;

  // HTML 태그 제거
  const text = html.replace(/<[^>]*>/g, '');

  // HTML 엔티티 디코딩
  const decoded = decode(text);

  // 보안 위험 요소 제거 (제어 문자, 유니코드 익스플로잇)
  const controlCharsStart = String.fromCharCode(0x00);
  const controlCharsEnd = String.fromCharCode(0x08);
  const controlChars2 = String.fromCharCode(0x0B, 0x0C);
  const controlChars3Start = String.fromCharCode(0x0E);
  const controlChars3End = String.fromCharCode(0x1F);
  const delChar = String.fromCharCode(0x7F);

  const sanitized = decoded
    .replace(new RegExp(`[${controlCharsStart}-${controlCharsEnd}${controlChars2}${controlChars3Start}-${controlChars3End}${delChar}]`, 'g'), '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return null;

  return sanitized.length > 300 ? sanitized.slice(0, 300) + '...' : sanitized;
}

/**
 * URL에서 og:image 메타태그 추출 (5초 타임아웃)
 * SSRF 보호: 내부 URL 차단 + OG 이미지 URL 검증
 */
export async function extractOgImage(url: string): Promise<string | null> {
  try {
    // SSRF 방지: 안전한 URL인지 검증
    if (!isSafeUrl(url)) {
      console.warn('[extractOgImage] Unsafe URL blocked:', url);
      return null;
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    const ogImageUrl = match?.[1] ?? null;

    // SSRF 방지: OG 이미지 URL 자체도 안전한지 검증
    if (ogImageUrl && !isSafeUrl(ogImageUrl)) {
      console.warn('[extractOgImage] Unsafe OG image URL blocked:', ogImageUrl);
      return null;
    }

    return ogImageUrl;
  } catch (error) {
    // 디버깅을 위한 에러 로그 (운영 환경에서도 유용)
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('timeout')) {
      console.warn('[extractOgImage] Timeout:', url);
    } else if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
      console.warn('[extractOgImage] Network error:', url);
    } else {
      console.error('[extractOgImage] Unexpected error:', { url, error: message });
    }
    return null;
  }
}
