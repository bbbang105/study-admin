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
import { scheduleCurationItemEmbeddingRefresh } from '@/lib/embedding-refresh';
import { utils } from '@blog-study/shared/utils';

const { extractFeedItems, sanitizeDescription, extractOgImage, inferCurationTags, isSafeUrl } =
  utils;

interface CrawlSourceResult {
  sourceId: string;
  sourceName: string;
  success: boolean;
  itemsFound: number;
  newItemsAdded: number;
  error?: string;
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
      const insertedItemIds: string[] = [];

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

          // P1 #8: 성능 개선 - 병렬 OG 이미지 추출
          const validItems = feedItems.filter((item) => item.link && item.title);

          // since 필터 및 description 사전 처리
          const itemsWithMetadata = validItems
            .filter((item) => {
              if (!sinceDate || !item.pubDate) return true;
              const pubDate = new Date(item.pubDate);
              return isNaN(pubDate.getTime()) || pubDate >= sinceDate;
            })
            .map((item) => ({
              item,
              description: sanitizeDescription(item.description),
            }));

          // OG 이미지 병렬 추출
          const thumbnailResults = await Promise.allSettled(
            itemsWithMetadata.map(({ item }) => extractOgImage(item.link!))
          );

          // DB 삽입은 순차 처리 (중복 체크 포함)
          for (let i = 0; i < itemsWithMetadata.length; i++) {
            const { item, description } = itemsWithMetadata[i]!;
            const result = thumbnailResults[i];
            const thumbnailUrl = result?.status === 'fulfilled' ? result.value : null;

            // URL 중복 체크
            const [existing] = await database
              .select({ id: curationItems.id })
              .from(curationItems)
              .where(eq(curationItems.url, item.link!))
              .limit(1);

            if (existing) continue;

            // Parse published date
            let publishedAt: Date | null = null;
            if (item.pubDate) {
              publishedAt = new Date(item.pubDate);
            }

            const inferredTags = inferCurationTags({
              title: item.title!,
              description,
              rawTags: [...(source.tags || []), ...(item.categories || [])],
            });

            const [created] = await database
              .insert(curationItems)
              .values({
                sourceId: source.id,
                title: item.title!,
                url: item.link!,
                description,
                thumbnailUrl,
                publishedAt,
                category: source.category,
                tags: inferredTags.length > 0 ? inferredTags : null,
                relevanceScore: 0,
                isShared: false,
              })
              .returning({ id: curationItems.id });

            if (created) insertedItemIds.push(created.id);
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
      scheduleCurationItemEmbeddingRefresh(insertedItemIds);

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
