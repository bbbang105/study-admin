/**
 * Ranking Service
 * 랭킹 조회 서비스
 * 주간/월간 랭킹, 포디움 추출
 */

import { and, count, eq, inArray, sql } from 'drizzle-orm';
import {
  getDb,
  members,
  posts,
  activityScores,
  MemberStatus,
} from '@blog-study/shared/db';

/**
 * 블로그 포스트 점수 (포스트 1개당 부여되는 점수)
 */
const BLOG_POST_SCORE_POINTS = 30;

/**
 * 랭킹 데이터 구조
 */
export interface RankingData {
  memberId: string;
  name: string;
  discordUsername: string;
  part: string;
  totalScore: number;
  postCount: number;
  activityScore: number;
  rank: number;
}

/**
 * 랭킹 조회 옵션
 */
export interface RankingOptions {
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'totalScore' | 'postCount' | 'activityScore';
}

export class RankingService {
  private db = getDb();

  /**
   * 전체 멤버 랭킹 조회
   * @param options 날짜 범위, 정렬 기준 등의 옵션
   * @returns 랭킹 데이터 배열
   */
  async getRankingData(options: RankingOptions = {}): Promise<RankingData[]> {
    const { startDate, endDate, sortBy = 'totalScore' } = options;

    // 활성 멤버만 조회
    const activeMembers = await this.db
      .select({
        id: members.id,
        name: members.name,
        discordUsername: members.discordUsername,
        part: members.part,
      })
      .from(members)
      .where(eq(members.status, MemberStatus.ACTIVE));

    if (activeMembers.length === 0) {
      return [];
    }

    const memberIds = activeMembers.map((m) => m.id);

    // 포스트 수 집계
    let postCounts = new Map<string, number>();
    const postConditions = [inArray(posts.memberId, memberIds)];

    // 날짜 범위 필터링
    if (startDate && endDate) {
      postConditions.push(
        and(
          sql`${posts.publishedAt} >= ${startDate}`,
          sql`${posts.publishedAt} <= ${endDate}`
        )!
      );
    }

    const postResults = await this.db
      .select({
        memberId: posts.memberId,
        count: count(posts.id),
      })
      .from(posts)
      .where(and(...postConditions))
      .groupBy(posts.memberId);
    postCounts = new Map(postResults.map((r) => [r.memberId, r.count]));

    // 활동 점수 집계
    let activityScoresMap = new Map<string, number>();
    const scoreConditions = [inArray(activityScores.memberId, memberIds)];

    // 날짜 범위 필터링
    if (startDate && endDate) {
      scoreConditions.push(
        and(
          sql`${activityScores.date} >= ${startDate.toISOString().split('T')[0]}`,
          sql`${activityScores.date} <= ${endDate.toISOString().split('T')[0]}`
        )!
      );
    }

    const scoreResults = await this.db
      .select({
        memberId: activityScores.memberId,
        totalScore: sql<number>`COALESCE(SUM(${activityScores.points}), 0)`,
      })
      .from(activityScores)
      .where(and(...scoreConditions))
      .groupBy(activityScores.memberId);
    activityScoresMap = new Map(
      scoreResults.map((r) => [r.memberId, Number(r.totalScore)])
    );

    // 랭킹 데이터 조립
    const rankings: RankingData[] = activeMembers.map((member) => {
      const postCount = postCounts.get(member.id) ?? 0;
      const activityScore = activityScoresMap.get(member.id) ?? 0;
      const totalScore = postCount * BLOG_POST_SCORE_POINTS + activityScore;

      return {
        memberId: member.id,
        name: member.name,
        discordUsername: member.discordUsername,
        part: member.part,
        totalScore,
        postCount,
        activityScore,
        rank: 0, // 정렬 후 할당
      };
    });

    // 정렬
    rankings.sort((a, b) => {
      if (sortBy === 'postCount') {
        return b.postCount - a.postCount || b.totalScore - a.totalScore;
      }
      if (sortBy === 'activityScore') {
        return b.activityScore - a.activityScore || b.totalScore - a.totalScore;
      }
      return b.totalScore - a.totalScore || b.postCount - a.postCount;
    });

    // 순위 할당 (동점자 처리)
    let currentRank = 1;
    for (let i = 0; i < rankings.length; i++) {
      if (i > 0) {
        const prev = rankings[i - 1]!;
        const curr = rankings[i]!;

        if (sortBy === 'postCount') {
          if (curr.postCount !== prev.postCount || curr.totalScore !== prev.totalScore) {
            currentRank = i + 1;
          }
        } else if (sortBy === 'activityScore') {
          if (curr.activityScore !== prev.activityScore || curr.totalScore !== prev.totalScore) {
            currentRank = i + 1;
          }
        } else {
          if (curr.totalScore !== prev.totalScore || curr.postCount !== prev.postCount) {
            currentRank = i + 1;
          }
        }
      }
      rankings[i]!.rank = currentRank;
    }

    return rankings;
  }

  /**
   * 상위 N명 추출 (포디움)
   * @param count 추출할 인원 수 (기본값: 3)
   * @param options 날짜 범위, 정렬 기준 등의 옵션
   * @returns 상위 N명의 랭킹 데이터
   */
  async getTopRankers(count: number = 3, options: RankingOptions = {}): Promise<RankingData[]> {
    const rankings = await this.getRankingData(options);
    return rankings.slice(0, Math.min(count, rankings.length));
  }

  /**
   * 주간 랭킹 조회
   * @param weeksAgo 몇 주 전 (기본값: 0, 현재 주)
   * @returns 주간 랭킹 데이터
   */
  async getWeeklyRanking(weeksAgo: number = 0): Promise<RankingData[]> {
    const now = new Date();

    // 한국 시간 기준 월요일 시작 주간 계산
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const kstDayOfWeek = (kstNow.getDay() + 6) % 7; // Monday = 0, Sunday = 6

    const monday = new Date(kstNow);
    monday.setDate(kstNow.getDate() - kstDayOfWeek - weeksAgo * 7);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return this.getRankingData({
      startDate: monday,
      endDate: sunday,
    });
  }

  /**
   * 월간 랭킹 조회
   * @param monthsAgo 몇 달 전 (기본값: 0, 현재 달)
   * @returns 월간 랭킹 데이터
   */
  async getMonthlyRanking(monthsAgo: number = 0): Promise<RankingData[]> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() - monthsAgo;

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    return this.getRankingData({
      startDate,
      endDate,
    });
  }

  /**
   * 멤버 ID로 순위 조회
   * @param memberId 멤버 ID
   * @param options 날짜 범위, 정렬 기준 등의 옵션
   * @returns 해당 멤버의 랭킹 데이터 (없으면 null)
   */
  async getMemberRank(memberId: string, options: RankingOptions = {}): Promise<RankingData | null> {
    const rankings = await this.getRankingData(options);
    return rankings.find((r) => r.memberId === memberId) ?? null;
  }

  /**
   * Discord 사용자명으로 순위 조회
   * @param discordUsername Discord 사용자명
   * @param options 날짜 범위, 정렬 기준 등의 옵션
   * @returns 해당 멤버의 랭킹 데이터 (없으면 null)
   */
  async getRankByDiscordUsername(
    discordUsername: string,
    options: RankingOptions = {}
  ): Promise<RankingData | null> {
    const rankings = await this.getRankingData(options);
    return rankings.find((r) => r.discordUsername === discordUsername) ?? null;
  }
}

// Singleton
let rankingServiceInstance: RankingService | null = null;

export function getRankingService(): RankingService {
  if (!rankingServiceInstance) {
    rankingServiceInstance = new RankingService();
  }
  return rankingServiceInstance;
}

export function resetRankingService(): void {
  rankingServiceInstance = null;
}
