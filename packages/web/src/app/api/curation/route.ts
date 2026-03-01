import { NextRequest, NextResponse } from 'next/server';
import { desc, count, eq, and, sql, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { successResponse, errorResponse } from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';

const { curationItems, curationSources } = sharedDb;

/**
 * GET /api/curation
 * Cursor-based pagination for infinite scroll
 * Supports category filter and tag AND-filter (up to 4 tags)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const tagsParam = searchParams.get('tags') || '';
    const cursor = searchParams.get('cursor');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));

    const database = db();

    // Build filter conditions (without cursor)
    const filterConditions = [];
    if (category !== 'all') {
      filterConditions.push(eq(curationItems.category, category));
    }

    const selectedTags = tagsParam
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4);

    if (selectedTags.length > 0) {
      filterConditions.push(
        sql`${curationItems.tags} @> ARRAY[${sql.join(
          selectedTags.map((t) => sql`${t}`),
          sql`,`
        )}]::text[]`
      );
    }

    // Total count (filter only, no cursor)
    const countWhere = filterConditions.length > 0 ? and(...filterConditions) : undefined;
    const totalCountResult = await database
      .select({ count: count() })
      .from(curationItems)
      .where(countWhere);
    const totalCount = totalCountResult[0]?.count ?? 0;

    // Query conditions = filter + cursor
    // Cursor format: "publishedAt|id" (composite to handle duplicate timestamps)
    const queryConditions = [...filterConditions];
    if (cursor) {
      const separatorIdx = cursor.lastIndexOf('|');
      const cursorDateStr = separatorIdx > 0 ? cursor.slice(0, separatorIdx) : '';
      const cursorId = separatorIdx > 0 ? cursor.slice(separatorIdx + 1) : '';
      const cursorDate = cursorDateStr ? new Date(cursorDateStr) : null;
      if (cursorDate && !isNaN(cursorDate.getTime()) && cursorId) {
        // (publishedAt < cursorDate) OR (publishedAt = cursorDate AND id < cursorId)
        queryConditions.push(
          sql`(${curationItems.publishedAt} < ${cursorDate} OR (${curationItems.publishedAt} = ${cursorDate} AND ${curationItems.id} < ${cursorId}))`
        );
      } else if (cursorId && !cursorDateStr) {
        // publishedAt was null — show items with null publishedAt and id < cursorId
        queryConditions.push(
          sql`(${curationItems.publishedAt} IS NULL AND ${curationItems.id} < ${cursorId})`
        );
      } else if (cursorDate && !isNaN(cursorDate.getTime())) {
        queryConditions.push(lt(curationItems.publishedAt, cursorDate));
      }
    }
    const whereClause = queryConditions.length > 0 ? and(...queryConditions) : undefined;

    // Fetch limit+1 to determine hasMore
    const itemsResult = await database
      .select({
        id: curationItems.id,
        title: curationItems.title,
        url: curationItems.url,
        description: curationItems.description,
        thumbnailUrl: curationItems.thumbnailUrl,
        publishedAt: curationItems.publishedAt,
        category: curationItems.category,
        tags: curationItems.tags,
        relevanceScore: curationItems.relevanceScore,
        isShared: curationItems.isShared,
        sharedAt: curationItems.sharedAt,
        sourceName: curationSources.name,
      })
      .from(curationItems)
      .leftJoin(curationSources, eq(curationItems.sourceId, curationSources.id))
      .where(whereClause)
      .orderBy(sql`${curationItems.publishedAt} DESC NULLS LAST`, desc(curationItems.id))
      .limit(limit + 1);

    const hasMore = itemsResult.length > limit;
    const items = hasMore ? itemsResult.slice(0, limit) : itemsResult;
    const lastItem = items[items.length - 1];
    // Composite cursor: "publishedAt|id" to handle duplicate timestamps
    const nextCursor = hasMore && lastItem
      ? `${lastItem.publishedAt?.toISOString() ?? ''}|${lastItem.id}`
      : null;

    return successResponse({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        description: item.description ?? null,
        thumbnailUrl: item.thumbnailUrl ?? null,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        category: item.category,
        tags: item.tags,
        relevanceScore: item.relevanceScore,
        sharedAt: item.isShared ? item.sharedAt?.toISOString() : null,
        sourceName: item.sourceName ?? null,
      })),
      nextCursor,
      hasMore,
      totalCount,
    });
  } catch (error) {
    console.error('Curation API error:', error);
    return errorResponse(error);
  }
}
