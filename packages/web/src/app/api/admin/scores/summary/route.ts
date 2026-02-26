import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { errorResponse, successResponse } from '@/lib/api-error';
import { withAdminAuth } from '@/lib/admin';

const { activityScores } = sharedDb;

/**
 * GET /api/admin/scores/summary
 * 전체 멤버별 총점 요약 (단일 쿼리)
 */
export const GET = withAdminAuth(async () => {
  try {
    const database = db();

    const scores = await database
      .select({
        memberId: activityScores.memberId,
        totalScore: sql<number>`COALESCE(SUM(${activityScores.points}), 0)`,
      })
      .from(activityScores)
      .groupBy(activityScores.memberId);

    const scoreMap: Record<string, number> = {};
    for (const row of scores) {
      scoreMap[row.memberId] = Number(row.totalScore);
    }

    return successResponse(scoreMap);
  } catch (error) {
    console.error('Admin scores summary error:', error);
    return errorResponse(error);
  }
});
