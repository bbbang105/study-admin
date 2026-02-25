import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, sql, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { curationItems, curationSources } from '@blog-study/shared/db';
import { withAdminAuth } from '@/lib/admin';

/**
 * GET /api/admin/curation/items
 * 수집된 큐레이션 아이템 목록 (페이지네이션, 필터)
 */
export const GET = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
    const category = searchParams.get('category') || 'all';
    const sourceId = searchParams.get('sourceId') || 'all';
    const offset = (page - 1) * limit;

    const database = getDb();

    // Build filter conditions
    const conditions = [];
    if (category !== 'all') {
      conditions.push(eq(curationItems.category, category));
    }
    if (sourceId !== 'all') {
      conditions.push(eq(curationItems.sourceId, sourceId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get items with source name
    const items = await database
      .select({
        id: curationItems.id,
        title: curationItems.title,
        url: curationItems.url,
        publishedAt: curationItems.publishedAt,
        category: curationItems.category,
        tags: curationItems.tags,
        relevanceScore: curationItems.relevanceScore,
        isShared: curationItems.isShared,
        collectedAt: curationItems.collectedAt,
        sourceId: curationItems.sourceId,
        sourceName: curationSources.name,
      })
      .from(curationItems)
      .leftJoin(curationSources, eq(curationItems.sourceId, curationSources.id))
      .where(whereClause)
      .orderBy(desc(curationItems.collectedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(curationItems)
      .where(whereClause);

    const total = countResult?.count || 0;

    // Get available sources for filter dropdown
    const sources = await database
      .select({ id: curationSources.id, name: curationSources.name })
      .from(curationSources)
      .orderBy(curationSources.name);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      sources,
    });
  } catch (error) {
    console.error('Error fetching curation items:', error);
    return NextResponse.json(
      { error: '아이템 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
});
