/**
 * Score Service
 * 활동 점수 관리 서비스
 * 블로그 포스팅, 디스코드 활동, 관리자 수동 부여
 */

import { and, eq, sql } from 'drizzle-orm';
import { activityScores, ActivityScoreType, type ActivityScoreTypeValue, getDb, members, } from '@blog-study/shared/db';

/** 점수 배점 및 일일 상한 */
export const SCORE_CONFIG: Record<
  ActivityScoreTypeValue,
  { points: number; dailyCap: number }
> = {
  [ActivityScoreType.BLOG_POST]: { points: 30, dailyCap: 60 },
  [ActivityScoreType.DISCORD_MESSAGE]: { points: 2, dailyCap: 10 },
  [ActivityScoreType.DISCORD_THREAD]: { points: 3, dailyCap: 9 },
  [ActivityScoreType.DISCORD_REACTION]: { points: 1, dailyCap: 5 },
  [ActivityScoreType.ADMIN_MANUAL]: { points: 0, dailyCap: Infinity },
  [ActivityScoreType.POST_VIEW]: { points: 2, dailyCap: 10 },
};

function getTodayDateString(): string {
  // KST (UTC+9) 기준 날짜
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0]!;
}

export class ScoreService {
  private db = getDb();

  /**
   * 해당 멤버의 오늘 특정 타입 누적 점수 조회
   */
  async getDailyTotal(memberId: string, type: ActivityScoreTypeValue, date?: string): Promise<number> {
    const targetDate = date ?? getTodayDateString();
    const result = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${activityScores.points}), 0)`,
      })
      .from(activityScores)
      .where(
        and(
          eq(activityScores.memberId, memberId),
          eq(activityScores.type, type),
          eq(activityScores.date, targetDate),
        )
      );
    return Number(result[0]?.total ?? 0);
  }

  /**
   * 점수 부여 (일일 상한 체크 포함 — 원자적 CTE로 race condition 방지)
   * @returns 실제 부여된 점수 (상한 초과 시 0)
   */
  async grantScore(
    memberId: string,
    type: ActivityScoreTypeValue,
    description?: string,
  ): Promise<number> {
    const config = SCORE_CONFIG[type];
    const today = getTodayDateString();
    const points = config.points;
    const desc = description ?? null;

    // 관리자 수동은 상한 체크 없이 즉시 삽입
    if (type === ActivityScoreType.ADMIN_MANUAL) {
      await this.db.insert(activityScores).values({
        memberId, type, points, description: desc, date: today,
      });
      return points;
    }

    // 원자적 조건부 INSERT: 일일 상한 미달일 때만 삽입
    const result = await this.db.execute(sql`
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

  /**
   * 관리자 수동 점수 부여/차감
   */
  async grantManualScore(
    memberId: string,
    points: number,
    description: string,
  ): Promise<void> {
    const today = getTodayDateString();
    await this.db.insert(activityScores).values({
      memberId,
      type: ActivityScoreType.ADMIN_MANUAL,
      points,
      description,
      date: today,
    });
  }

  /**
   * 멤버의 총 점수 조회
   */
  async getTotalScore(memberId: string): Promise<number> {
    const result = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${activityScores.points}), 0)`,
      })
      .from(activityScores)
      .where(eq(activityScores.memberId, memberId));
    return Number(result[0]?.total ?? 0);
  }

  /**
   * 멤버의 점수 내역 조회
   */
  async getScoreHistory(
    memberId: string,
    limit = 50,
    offset = 0,
  ) {
    const records = await this.db
      .select()
      .from(activityScores)
      .where(eq(activityScores.memberId, memberId))
      .orderBy(sql`${activityScores.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(activityScores)
      .where(eq(activityScores.memberId, memberId));

    return {
      records,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  /**
   * Discord ID로 멤버 ID 조회
   */
  async getMemberIdByDiscordId(discordId: string): Promise<string | null> {
    const [member] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);
    return member?.id ?? null;
  }

  /**
   * 전체 멤버 총점 랭킹
   */
  async getAllScores() {
    return this.db
      .select({
        memberId: activityScores.memberId,
        totalScore: sql<number>`COALESCE(SUM(${activityScores.points}), 0)`,
      })
      .from(activityScores)
      .groupBy(activityScores.memberId);
  }
}

// Singleton
let scoreServiceInstance: ScoreService | null = null;

export function getScoreService(): ScoreService {
  if (!scoreServiceInstance) {
    scoreServiceInstance = new ScoreService();
  }
  return scoreServiceInstance;
}
