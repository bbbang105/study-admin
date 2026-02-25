import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { parseFeed } from 'feedsmith';
import { getDb } from '@/lib/db';
import { curationSources, curationItems } from '@blog-study/shared/db';
import { withAdminAuth } from '@/lib/admin';

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
      categories: entry.categories?.map((c) => c.term).filter(Boolean) as string[],
    }));
  }

  if (format === 'rss') {
    return (feed.items ?? []).map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate ? String(item.pubDate) : undefined,
      categories: item.categories?.map((c) => typeof c === 'string' ? c : c.name).filter(Boolean) as string[],
    }));
  }

  if (format === 'json') {
    return (feed.items ?? []).map((item) => ({
      title: item.title,
      link: item.url ?? item.external_url,
      pubDate: item.date_published ?? item.date_modified,
      categories: item.tags,
    }));
  }

  // RDF
  return (feed.items ?? []).map((item) => ({
    title: item.title,
    link: item.link,
    pubDate: item.dc?.date,
  }));
}

/**
 * POST /api/admin/curation/crawl
 * 활성 소스의 RSS를 크롤링하여 curation_items에 저장
 */
export const POST = withAdminAuth(async (_request: NextRequest, _adminAuth) => {
  try {
    const database = getDb();

    // 활성 소스 중 rssUrl이 있는 것만 대상
    const sources = await database
      .select()
      .from(curationSources)
      .where(eq(curationSources.isActive, true));

    const rssEnabledSources = sources.filter((s) => s.rssUrl);

    if (rssEnabledSources.length === 0) {
      return NextResponse.json({
        results: [],
        summary: { totalSources: 0, totalNewItems: 0 },
        message: 'RSS URL이 설정된 활성 소스가 없습니다.',
      });
    }

    const results: CrawlSourceResult[] = [];

    for (const source of rssEnabledSources) {
      try {
        // Fetch RSS feed
        const response = await fetch(source.rssUrl!, {
          headers: { 'User-Agent': 'BlogStudyBot/1.0' },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            success: false,
            itemsFound: 0,
            newItemsAdded: 0,
            error: `HTTP ${response.status}`,
          });
          continue;
        }

        const xml = await response.text();
        const parsed = parseFeed(xml);
        const feedItems = extractFeedItems(parsed);

        let newItemsAdded = 0;

        for (const item of feedItems) {
          if (!item.link || !item.title) continue;

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

          await database.insert(curationItems).values({
            sourceId: source.id,
            title: item.title,
            url: item.link,
            publishedAt,
            category: source.category,
            tags: mergedTags.length > 0 ? mergedTags : null,
            relevanceScore: 0,
            isShared: false,
          });

          newItemsAdded++;
        }

        results.push({
          sourceId: source.id,
          sourceName: source.name,
          success: true,
          itemsFound: feedItems.length,
          newItemsAdded,
        });
      } catch (error) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          itemsFound: 0,
          newItemsAdded: 0,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    const totalNewItems = results.reduce((sum, r) => sum + r.newItemsAdded, 0);

    return NextResponse.json({
      results,
      summary: {
        totalSources: rssEnabledSources.length,
        totalNewItems,
        successCount: results.filter((r) => r.success).length,
        failCount: results.filter((r) => !r.success).length,
      },
    });
  } catch (error) {
    console.error('Error during manual crawl:', error);
    return NextResponse.json(
      { error: '크롤링 실행 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
