/**
 * Web Activity Score Service
 * 웹 활동(게시판 글, 댓글 등)에 대한 점수 부여 유틸리티
 */

import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';

const { activityScores, members, ActivityScoreType, MemberStatus } = sharedDb;

export type WebScoreType =
  | typeof ActivityScoreType.BOARD_POST
  | typeof ActivityScoreType.POST_COMMENT
  | typeof ActivityScoreType.BOARD_COMMENT
  | typeof ActivityScoreType.POST_VIEW;

/** 점수 배점 및 일일 상한 */
export const SCORE_CONFIG: Record<WebScoreType, { points: number; dailyCap: number }> = {
  [ActivityScoreType.BOARD_POST]: { points: 10, dailyCap: 20 },
  [ActivityScoreType.POST_COMMENT]: { points: 5, dailyCap: 20 },
  [ActivityScoreType.BOARD_COMMENT]: { points: 2, dailyCap: 10 },
  [ActivityScoreType.POST_VIEW]: { points: 3, dailyCap: 15 },
};

export function getTodayDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0]!;
}

/**
 * 웹 활동 점수 부여 (일일 상한 체크 포함, 원자적 CTE)
 * @returns 실제 부여된 점수 (상한 초과 시 0)
 */
export async function grantWebScore(
  memberId: string,
  type: WebScoreType,
  description?: string,
): Promise<number> {
  const config = SCORE_CONFIG[type];
  if (!config) return 0;

  const database = getDb();

  // active 멤버만 점수 부여
  const [member] = await database
    .select({ status: members.status })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!member || member.status !== MemberStatus.ACTIVE) return 0;

  const today = getTodayDateString();
  const points = config.points;
  const desc = description ?? null;

  const result = await database.execute(sql`
    WITH daily AS (
      SELECT COALESCE(SUM(${activityScores.points}), 0) AS total
      FROM ${activityScores}
      WHERE ${activityScores.memberId} = ${memberId}
        AND ${activityScores.type} = ${type}
        AND ${activityScores.date} = ${today}
    )
    INSERT INTO activity_scores (id, member_id, type, points, description, date)
    SELECT gen_random_uuid(), ${memberId}, ${type}, ${points}, ${desc}, ${today}
    FROM daily
    WHERE daily.total < ${config.dailyCap}
    RETURNING points
  `);

  return result.length > 0 ? points : 0;
}
