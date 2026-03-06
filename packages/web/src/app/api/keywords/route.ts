import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { errorResponse, successResponse } from '@/lib/api-error';

const { keywords } = sharedDb;

/**
 * GET /api/keywords
 * Get top keywords (interest analysis)
 * Requirement: 14.3 - /관심분야 command equivalent
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));

    const database = db();

    // Get top keywords by frequency
    const topKeywords = await database
      .select({
        id: keywords.id,
        keyword: keywords.keyword,
        frequency: keywords.frequency,
        lastUpdated: keywords.lastUpdated,
      })
      .from(keywords)
      .orderBy(desc(keywords.frequency))
      .limit(limit);

    // Calculate total frequency for percentage
    const totalFrequency = topKeywords.reduce((sum, k) => sum + (k.frequency ?? 0), 0);

    return successResponse({
      keywords: topKeywords.map((k, index) => ({
        rank: index + 1,
        keyword: k.keyword,
        frequency: k.frequency ?? 0,
        percentage:
          totalFrequency > 0
            ? Math.round(((k.frequency ?? 0) / totalFrequency) * 100 * 10) / 10
            : 0,
        lastUpdated: k.lastUpdated?.toISOString(),
      })),
      total: topKeywords.length,
      totalFrequency,
    });
  } catch (error) {
    console.error('Keywords API error:', error);
    return errorResponse(error);
  }
}
