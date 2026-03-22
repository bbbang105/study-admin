/**
 * Weekly Ranking Scheduler
 * 매주 일요일 10:00에 전체 멤버 랭킹 발송
 */

import { bold, Client, EmbedBuilder } from 'discord.js';
import { count, eq, inArray, sql } from 'drizzle-orm';
import logger from '../lib/logger';
import { activityScores, ActivityScoreType, getDb, members, MemberStatus, posts } from '@blog-study/shared/db';
import { ConfigKeys, getConfigValue } from '../services/round.service';

/**
 * Result of a weekly ranking cycle
 */
export interface WeeklyRankingResult {
  timestamp: Date;
  rankingSent: boolean;
  totalMembers: number;
  errors: string[];
  warnings?: string[];
}

/**
 * Member ranking data
 */
interface MemberRanking {
  memberId: string;
  name: string;
  nickname: string;
  discordId: string;
  discordUsername: string;
  totalScore: number;
  postCount: number;
  webActivityScore: number;
  rank: number;
}

/**
 * 전체 누적 기준 멤버 랭킹 조회
 */
async function getMemberRankings(): Promise<MemberRanking[]> {
  const db = getDb();

  // active 멤버 + 포스트 수
  const membersWithPosts = await db
    .select({
      memberId: members.id,
      name: members.name,
      nickname: members.nickname,
      discordId: members.discordId,
      discordUsername: members.discordUsername,
      postCount: count(posts.id),
    })
    .from(members)
    .leftJoin(posts, eq(members.id, posts.memberId))
    .where(inArray(members.status, [MemberStatus.ACTIVE, MemberStatus.OB, MemberStatus.DORMANT]))
    .groupBy(members.id);

  // 전체 누적 점수 (주간 필터 없음 — 웹 랭킹과 동일)
  const scoreStats = await db
    .select({
      memberId: activityScores.memberId,
      totalScore: sql<number>`COALESCE(SUM(${activityScores.points}), 0)`,
      webActivityScore: sql<number>`COALESCE(SUM(CASE WHEN ${activityScores.type} IN (${ActivityScoreType.BOARD_POST}, ${ActivityScoreType.POST_COMMENT}, ${ActivityScoreType.BOARD_COMMENT}, ${ActivityScoreType.POST_VIEW}) THEN ${activityScores.points} ELSE 0 END), 0)`,
    })
    .from(activityScores)
    .groupBy(activityScores.memberId);

  const totalScoreMap = new Map<string, number>();
  const webActivityMap = new Map<string, number>();

  for (const stat of scoreStats) {
    totalScoreMap.set(stat.memberId, Number(stat.totalScore));
    webActivityMap.set(stat.memberId, Number(stat.webActivityScore));
  }

  const rankings: MemberRanking[] = membersWithPosts.map((member) => ({
    memberId: member.memberId,
    name: member.name,
    nickname: member.nickname,
    discordId: member.discordId,
    discordUsername: member.discordUsername,
    totalScore: totalScoreMap.get(member.memberId) ?? 0,
    postCount: Number(member.postCount),
    webActivityScore: webActivityMap.get(member.memberId) ?? 0,
    rank: 0,
  }));

  rankings.sort((a, b) =>
    b.totalScore - a.totalScore || b.postCount - a.postCount
  );

  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });

  return rankings;
}

/**
 * Discord 임베드 생성
 */
function createRankingEmbed(rankings: MemberRanking[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🏆 주간 랭킹')
    .setDescription('누적 활동 점수 기준 전체 랭킹입니다.')
    .setColor(0x0091FF)
    .setTimestamp();

  // 포디움 (Top 3)
  const top3 = rankings.slice(0, 3);
  if (top3.length > 0) {
    const medals = ['🥇', '🥈', '🥉'];
    let podiumText = '';

    for (let i = 0; i < top3.length; i++) {
      const r = top3[i]!;
      const medal = medals[i] ?? '🏅';
      const activity = r.webActivityScore > 0 ? ` | 활동 ${r.webActivityScore}pt` : '';
      podiumText += `${medal} <@${r.discordId}> — ${bold(`${r.totalScore}pt`)} (포스트 ${r.postCount}개${activity})\n`;
    }

    embed.addFields({
      name: '# 👑 포디움',
      value: podiumText.length > 1024 ? podiumText.substring(0, 1021) + '...' : podiumText,
      inline: false,
    });
  }

  // 전체 랭킹 (전원 표시, 1024자 제한 시 여러 field로 분할)
  const rankingLines: string[] = [];
  for (const r of rankings) {
    const rankDisplay = r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] ?? `${r.rank}.` : `${r.rank}.`;
    const activity = r.webActivityScore > 0 ? ` | 활동 ${r.webActivityScore}pt` : '';
    rankingLines.push(`${rankDisplay} <@${r.discordId}> — ${r.totalScore}pt (포스트 ${r.postCount}개${activity})`);
  }

  if (rankingLines.length === 0) {
    embed.addFields({
      name: `# 📊 전체 랭킹`,
      value: '등록된 멤버가 없습니다.',
      inline: false,
    });
  } else {
    // 1024자 제한 대응: 여러 field로 분할
    let chunk = '';
    let isFirst = true;
    for (const line of rankingLines) {
      if (chunk.length + line.length + 1 > 1000) {
        embed.addFields({
          name: isFirst ? `# 📊 전체 랭킹 (${rankings.length}명)` : '\u200b',
          value: chunk,
          inline: false,
        });
        chunk = '';
        isFirst = false;
      }
      chunk += (chunk ? '\n' : '') + line;
    }
    if (chunk) {
      embed.addFields({
        name: isFirst ? `# 📊 전체 랭킹 (${rankings.length}명)` : '\u200b',
        value: chunk,
        inline: false,
      });
    }
  }

  return embed;
}

/**
 * Weekly Ranking class
 */
export class WeeklyRanking {
  private isRunning = false;
  private client: Client | null = null;

  setClient(client: Client): void {
    this.client = client;
  }

  getClient(): Client | null {
    return this.client;
  }

  isSending(): boolean {
    return this.isRunning;
  }

  async sendWeeklyRanking(): Promise<WeeklyRankingResult> {
    if (this.isRunning) {
      logger.info('🏆 [주간 랭킹] 이미 실행 중, 건너뜀');
      return {
        timestamp: new Date(),
        rankingSent: false,
        totalMembers: 0,
        errors: ['이미 실행 중'],
        warnings: [],
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!this.client) {
        throw new Error('Discord client 미설정');
      }

      logger.info('🏆 [주간 랭킹] 멤버 랭킹 조회 중...');

      const rankings = await getMemberRankings();

      if (rankings.length === 0) {
        logger.info('🏆 [주간 랭킹] 활성 멤버 없음');
        warnings.push('활성 멤버 없음');

        return {
          timestamp: startTime,
          rankingSent: false,
          totalMembers: 0,
          errors: [],
          warnings,
        };
      }

      logger.info(`🏆 [주간 랭킹] ${rankings.length}명 조회 완료`);

      const channelId = await getConfigValue(ConfigKeys.RANKING_CHANNEL_ID);

      if (!channelId) {
        throw new Error('ranking_channel_id 미설정');
      }

      const embed = createRankingEmbed(rankings);
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        throw new Error(`유효하지 않은 채널: ${channelId}`);
      }

      await channel.send({ embeds: [embed] });

      logger.info(`🏆 [주간 랭킹] 발송 완료 ✅ (${rankings.length}명)`);

      return {
        timestamp: startTime,
        rankingSent: true,
        totalMembers: rankings.length,
        errors,
        warnings,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`🏆 [주간 랭킹] 에러: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        rankingSent: false,
        totalMembers: 0,
        errors,
        warnings,
      };
    } finally {
      this.isRunning = false;
    }
  }
}

// Singleton instance
let weeklyRankingInstance: WeeklyRanking | null = null;

export function getWeeklyRanking(): WeeklyRanking {
  if (!weeklyRankingInstance) {
    weeklyRankingInstance = new WeeklyRanking();
  }
  return weeklyRankingInstance;
}

export function resetWeeklyRanking(): void {
  weeklyRankingInstance = null;
}
