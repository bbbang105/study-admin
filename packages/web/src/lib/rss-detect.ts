/**
 * RSS URL 자동 감지 (웹 서버용)
 * 블로그 URL로부터 RSS URL을 감지하고 검증
 */

import { utils } from '@blog-study/shared';

const { detectBlogPlatform } = utils;

const HTTP_TIMEOUT = 10000;

/**
 * 플랫폼별 RSS URL 생성
 */
function constructRssUrl(blogUrl: string, platform: string): string | null {
  try {
    const url = new URL(blogUrl);

    switch (platform) {
      case 'velog': {
        // https://velog.io/@username or https://velog.io/@username/posts
        const match = url.pathname.match(/^\/@([\w-]+)(\/posts)?\/?$/);
        return match ? `https://v2.velog.io/rss/@${match[1]}` : null;
      }
      case 'tistory':
        return `${url.protocol}//${url.hostname}/rss`;
      case 'medium': {
        const match = url.pathname.match(/^\/@([\w-]+)\/?$/);
        return match ? `https://medium.com/feed/@${match[1]}` : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * RSS URL이 유효한 피드인지 검증 (간단한 XML/JSON 체크)
 */
async function isValidFeed(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
      signal: AbortSignal.timeout(HTTP_TIMEOUT),
    });
    if (!res.ok) return false;
    const text = await res.text();
    // RSS/Atom은 XML, JSON Feed는 JSON
    return text.includes('<rss') || text.includes('<feed') || text.includes('<rdf:RDF') || text.includes('"version"');
  } catch {
    return false;
  }
}

/**
 * HTML에서 RSS link 태그 추출
 */
function extractRssFromHtml(html: string): string | null {
  // <link ... type="application/rss+xml" ... href="..." />
  const rssMatch = html.match(/<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/rss\+xml["']/i);
  if (rssMatch?.[1]) return rssMatch[1];

  // <link ... type="application/atom+xml" ... href="..." />
  const atomMatch = html.match(/<link[^>]+type=["']application\/atom\+xml["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/atom\+xml["']/i);
  if (atomMatch?.[1]) return atomMatch[1];

  return null;
}

/**
 * 블로그 URL로부터 RSS URL 자동 감지
 * @returns 감지된 RSS URL 또는 null
 */
export async function detectRssUrl(blogUrl: string): Promise<string | null> {
  const platform = detectBlogPlatform(blogUrl);

  // 1단계: 플랫폼별 규칙으로 RSS URL 생성 + 검증
  if (platform !== 'unknown') {
    const rssUrl = constructRssUrl(blogUrl, platform);
    if (rssUrl && await isValidFeed(rssUrl)) {
      return rssUrl;
    }
  }

  // 2단계: HTML link 태그에서 RSS 발견
  try {
    const res = await fetch(blogUrl, {
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
      signal: AbortSignal.timeout(HTTP_TIMEOUT),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const rssUrl = extractRssFromHtml(html);
    if (rssUrl) {
      const absoluteUrl = new URL(rssUrl, blogUrl).toString();
      if (await isValidFeed(absoluteUrl)) {
        return absoluteUrl;
      }
    }
  } catch {
    // 블로그 페이지 접근 실패
  }

  return null;
}
