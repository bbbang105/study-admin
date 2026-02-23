import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { curationSources, curationItems, CurationCategory } from '@blog-study/shared/db';
import { withAdminAuth } from '@/lib/admin';

/**
 * GET /api/admin/curation
 * Get all curation sources with item counts
 * Requirements: 15.5
 */
export const GET = withAdminAuth(async (_request: NextRequest, _adminAuth) => {
  try {
    const database = getDb();

    // Get all sources
    const sources = await database
      .select()
      .from(curationSources)
      .orderBy(desc(curationSources.createdAt));

    // Get item counts per source
    const itemCounts = await database
      .select({
        sourceId: curationItems.sourceId,
        count: sql<number>`count(*)::int`,
      })
      .from(curationItems)
      .groupBy(curationItems.sourceId);

    // Create a map of source ID to item count
    const countMap = new Map<string, number>();
    for (const item of itemCounts) {
      if (item.sourceId) {
        countMap.set(item.sourceId, item.count);
      }
    }

    // Combine sources with item counts
    const sourcesWithCounts = sources.map((source) => ({
      ...source,
      itemCount: countMap.get(source.id) || 0,
    }));

    // Get summary stats
    const totalItems = await database.select({ count: sql<number>`count(*)::int` }).from(curationItems);
    const sharedItems = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(curationItems)
      .where(eq(curationItems.isShared, true));

    return NextResponse.json({
      sources: sourcesWithCounts,
      stats: {
        totalSources: sources.length,
        activeSources: sources.filter((s) => s.isActive).length,
        totalItems: totalItems[0]?.count || 0,
        sharedItems: sharedItems[0]?.count || 0,
      },
      categories: Object.values(CurationCategory),
    });
  } catch (error) {
    console.error('Error fetching curation sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch curation sources' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/curation
 * Add a new curation source
 * Requirements: 15.5
 */
export const POST = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const body = await request.json();
    const { url, name, category } = body;

    // Validate required fields
    if (!url || !name || !category) {
      return NextResponse.json(
        { error: 'URL, 이름, 카테고리는 필수입니다.' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = Object.values(CurationCategory);
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `유효하지 않은 카테고리입니다. (${validCategories.join(', ')})` },
        { status: 400 }
      );
    }

    const database = getDb();

    // Check for duplicate URL
    const [existing] = await database
      .select()
      .from(curationSources)
      .where(eq(curationSources.url, url))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: '이미 등록된 URL입니다.' },
        { status: 400 }
      );
    }

    // Create new source
    const [created] = await database
      .insert(curationSources)
      .values({
        url,
        name,
        category,
        isActive: true,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating curation source:', error);
    return NextResponse.json(
      { error: 'Failed to create curation source' },
      { status: 500 }
    );
  }
});
