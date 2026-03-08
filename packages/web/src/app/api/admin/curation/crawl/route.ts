import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { parseFeed } from 'feedsmith';
import { getDb } from '@/lib/db';
import { curationItems, curationSources } from '@blog-study/shared/db';
import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  verifyAdminAccess,
} from '@/lib/admin';
import { isSafeUrl } from '@/lib/rss-detect';

interface CrawlSourceResult {
  sourceId: string;
  sourceName: string;
  success: boolean;
  itemsFound: number;
  newItemsAdded: number;
  error?: string;
}

interface NormalizedFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  categories?: string[];
}

/**
 * Normalize feed items across different formats (RSS/Atom/JSON/RDF)
 */
function extractFeedItems(result: ReturnType<typeof parseFeed>): NormalizedFeedItem[] {
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
 * HTML 태그 제거 + 300자 truncate
 */
function sanitizeDescription(html: string | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > 300 ? text.slice(0, 300) + '...' : text;
}

/**
 * URL에서 og:image 메타태그 추출 (5초 타임아웃)
 */
async function extractOgImage(url: string): Promise<string | null> {
  try {
    if (!isSafeUrl(url)) return null;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/curation/crawl
 * 활성 소스의 RSS를 크롤링하여 curation_items에 저장
 * SSE 스트리밍으로 소스별 진행 상황 전달
 */
export async function POST(request: NextRequest) {
  // 인증 체크
  const adminAuth = await verifyAdminAccess();
  if (!adminAuth.isAuthenticated) {
    return createUnauthorizedResponse(adminAuth.error);
  }
  if (!adminAuth.isAdmin) {
    return createForbiddenResponse(adminAuth.error);
  }

  // Parse request body for optional `since` filter
  let sinceDate: Date | null = null;
  try {
    const body = await request.json();
    if (body.since) {
      sinceDate = new Date(body.since);
      if (isNaN(sinceDate.getTime())) sinceDate = null;
    }
  } catch {
    // empty body is fine — no filter
  }

  const database = getDb();

  // 활성 소스 중 rssUrl이 있는 것만 대상
  const sources = await database
    .select()
    .from(curationSources)
    .where(eq(curationSources.isActive, true));

  const rssEnabledSources = sources.filter((s) => s.rssUrl);

  // SSE 스트리밍
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      // 시작 이벤트
      send('start', {
        totalSources: rssEnabledSources.length,
        sourceNames: rssEnabledSources.map((s) => s.name),
      });

      if (rssEnabledSources.length === 0) {
        send('complete', {
          results: [],
          summary: { totalSources: 0, totalNewItems: 0, successCount: 0, failCount: 0 },
          message: 'RSS URL이 설정된 활성 소스가 없습니다.',
        });
        controller.close();
        return;
      }

      const results: CrawlSourceResult[] = [];

      for (let i = 0; i < rssEnabledSources.length; i++) {
        const source = rssEnabledSources[i]!;

        // 현재 처리 중인 소스 알림
        send('processing', {
          index: i,
          sourceName: source.name,
          total: rssEnabledSources.length,
        });

        try {
          // SSRF 방지: RSS URL 검증
          if (!isSafeUrl(source.rssUrl!)) {
            const result: CrawlSourceResult = {
              sourceId: source.id,
              sourceName: source.name,
              success: false,
              itemsFound: 0,
              newItemsAdded: 0,
              error: '안전하지 않은 URL입니다.',
            };
            results.push(result);
            send('progress', { index: i, result });
            continue;
          }

          // Fetch RSS feed
          const response = await fetch(source.rssUrl!, {
            headers: { 'User-Agent': 'BlogStudyBot/1.0' },
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            const result: CrawlSourceResult = {
              sourceId: source.id,
              sourceName: source.name,
              success: false,
              itemsFound: 0,
              newItemsAdded: 0,
              error: `HTTP ${response.status}`,
            };
            results.push(result);
            send('progress', { index: i, result });
            continue;
          }

          const xml = await response.text();
          const parsed = parseFeed(xml);
          const feedItems = extractFeedItems(parsed);

          let newItemsAdded = 0;

          for (const item of feedItems) {
            if (!item.link || !item.title) continue;

            // since 필터: publishedAt이 sinceDate보다 이전이면 skip
            if (sinceDate && item.pubDate) {
              const pubDate = new Date(item.pubDate);
              if (!isNaN(pubDate.getTime()) && pubDate < sinceDate) continue;
            }

            // URL 중복 체크
            const [existing] = await database
              .select({ id: curationItems.id })
              .from(curationItems)
              .where(eq(curationItems.url, item.link))
              .limit(1);

            if (existing) continue;

            // Merge source tags + item tags
            const mergedTags = [...new Set([...(source.tags || []), ...(item.categories || [])])];

            // Parse published date
            let publishedAt: Date | null = null;
            if (item.pubDate) {
              publishedAt = new Date(item.pubDate);
            }

            const description = sanitizeDescription(item.description);
            const thumbnailUrl = await extractOgImage(item.link);

            await database.insert(curationItems).values({
              sourceId: source.id,
              title: item.title,
              url: item.link,
              description,
              thumbnailUrl,
              publishedAt,
              category: source.category,
              tags: mergedTags.length > 0 ? mergedTags : null,
              relevanceScore: 0,
              isShared: false,
            });

            newItemsAdded++;
          }

          const result: CrawlSourceResult = {
            sourceId: source.id,
            sourceName: source.name,
            success: true,
            itemsFound: feedItems.length,
            newItemsAdded,
          };
          results.push(result);
          send('progress', { index: i, result });
        } catch (error) {
          const result: CrawlSourceResult = {
            sourceId: source.id,
            sourceName: source.name,
            success: false,
            itemsFound: 0,
            newItemsAdded: 0,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          };
          results.push(result);
          send('progress', { index: i, result });
        }
      }

      const totalNewItems = results.reduce((sum, r) => sum + r.newItemsAdded, 0);

      send('complete', {
        results,
        summary: {
          totalSources: rssEnabledSources.length,
          totalNewItems,
          successCount: results.filter((r) => r.success).length,
          failCount: results.filter((r) => !r.success).length,
        },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
