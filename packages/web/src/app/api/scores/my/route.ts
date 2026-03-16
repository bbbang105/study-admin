import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';
import { getTodayDateString } from '@/lib/score';
import { SCORE_TYPE_META } from '@/lib/score-config';

const { activityScores, members } = sharedDb;

/** 대시보드 프로그레스에 표시할 타입 (관리자 수동 제외) */
const SCORE_TYPES = SCORE_TYPE_META.filter((m) => m.type !== 'admin_manual');

/**
 * GET /api/scores/my
 * 대시보드용: 내 총점 + 오늘 활동별 진행 상황 + 최근 활동 5개
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Errors.unauthorized().toResponse();
    }

    const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
    const discordId = discordIdentity?.id;
    if (!discordId) {
      return Errors.badRequest('Discord 연결이 필요합니다.').toResponse();
    }

    const database = getDb();

    const [member] = await database
      .select({ id: members.id })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!member) {
      return successResponse({ totalScore: 0, todayScore: 0, todayProgress: [], recentActivity: [] });
    }

    const today = getTodayDateString();

    // 총점 + 오늘 타입별 합산을 단일 쿼리로 조회 + 최근 활동 5개 병렬 실행
    const [scoreStats, recentActivity] = await Promise.all([
      database.execute(sql`
        SELECT
          COALESCE(SUM(${activityScores.points}), 0)::int AS total_score,
          COALESCE(SUM(CASE WHEN ${activityScores.date} = ${today} THEN ${activityScores.points} ELSE 0 END), 0)::int AS today_total,
          ${activityScores.type} AS type,
          COALESCE(SUM(CASE WHEN ${activityScores.date} = ${today} THEN ${activityScores.points} ELSE 0 END), 0)::int AS today_earned
        FROM ${activityScores}
        WHERE ${activityScores.memberId} = ${member.id}
        GROUP BY ${activityScores.type}
      `),
      database
        .select({
          id: activityScores.id,
          type: activityScores.type,
          points: activityScores.points,
          description: activityScores.description,
          createdAt: activityScores.createdAt,
        })
        .from(activityScores)
        .where(eq(activityScores.memberId, member.id))
        .orderBy(desc(activityScores.createdAt))
        .limit(5),
    ]);

    // 결과 파싱
    let totalScore = 0;
    const todayMap = new Map<string, number>();
    for (const row of scoreStats as unknown as Array<{ total_score: number; type: string; today_earned: number }>) {
      totalScore += Number(row.total_score);
      todayMap.set(row.type, Number(row.today_earned));
    }

    const todayProgress = SCORE_TYPES.map((config) => ({
      type: config.type,
      label: config.label,
      emoji: config.emoji,
      points: config.points,
      earned: todayMap.get(config.type) ?? 0,
      dailyCap: config.dailyCap,
    }));

    const todayScore = todayProgress.reduce((sum, p) => sum + p.earned, 0);

    return successResponse({
      totalScore,
      todayScore,
      todayProgress,
      recentActivity,
    });
  } catch (error) {
    console.error('My scores API error:', error);
    return errorResponse(error);
  }
}
