import { NextRequest } from 'next/server';
import { desc, count, eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { successResponse, errorResponse } from '@/lib/api-error';

const { curationItems } = sharedDb;

/**
 * GET /api/curation
 * Get curated articles and conferences
 * Requirement: 18.3
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const database = db();

    // Build query conditions
    const conditions = [];
    if (category !== 'all') {
      conditions.push(eq(curationItems.category, category));
    }

    // Get total count
    const totalCountResult = await database
      .select({ count: count() })
      .from(curationItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const totalCount = totalCountResult[0]?.count ?? 0;

    // Get curation items
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
      })
      .from(curationItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(curationItems.relevanceScore), desc(curationItems.collectedAt))
      .limit(Math.min(100, limit));

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
      })),
      totalCount,
    });
  } catch (error) {
    console.error('Curation API error:', error);
    return errorResponse(error);
  }
}
