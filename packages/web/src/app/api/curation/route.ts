import { NextRequest, NextResponse } from 'next/server';
import { desc, count, eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { successResponse, errorResponse } from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';

const { curationItems, curationSources } = sharedDb;

/**
 * GET /api/curation
 * Get curated articles and conferences
 * Supports category filter and tag AND-filter (up to 4 tags)
 * Tags are predefined in INTEREST_OPTIONS (shared config)
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
    const offset = (page - 1) * limit;

    const database = db();

    // Build query conditions
    const conditions = [];
    if (category !== 'all') {
      conditions.push(eq(curationItems.category, category));
    }

    // Tag AND-filter: items must contain ALL selected tags
    const selectedTags = tagsParam
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4);

    if (selectedTags.length > 0) {
      conditions.push(
        sql`${curationItems.tags} @> ARRAY[${sql.join(
          selectedTags.map((t) => sql`${t}`),
          sql`,`
        )}]::text[]`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalCountResult = await database
      .select({ count: count() })
      .from(curationItems)
      .where(whereClause);
    const totalCount = totalCountResult[0]?.count ?? 0;

    // Get curation items with source name
    const itemsResult = await database
      .select({
        id: curationItems.id,
        title: curationItems.title,
        url: curationItems.url,
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
      .orderBy(desc(curationItems.relevanceScore), desc(curationItems.collectedAt))
      .limit(limit)
      .offset(offset);

    return successResponse({
      items: itemsResult.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        category: item.category,
        tags: item.tags,
        relevanceScore: item.relevanceScore,
        sharedAt: item.isShared ? item.sharedAt?.toISOString() : null,
        sourceName: item.sourceName ?? null,
      })),
      totalCount,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Curation API error:', error);
    return errorResponse(error);
  }
}
