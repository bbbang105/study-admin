/**
 * Weekly Ranking Scheduler
 * 매주 일요일 22:00에 전체 멤버 랭킹 발송
 */

import { Client, EmbedBuilder, bold } from 'discord.js';
import { count, eq, sql } from 'drizzle-orm';
import {
  getDb,
  members,
  posts,
  activityScores,
  MemberStatus,
  ActivityScoreType,
} from '@blog-study/shared/db';
import { getConfigValue, ConfigKeys } from '../services/round.service';

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
  discordUsername: string;
  totalScore: number;
  postCount: number;
  discordScore: number;
  rank: number;
}

/**
 * Format KST date to ISO date string (YYYY-MM-DD)
 */
function formatKSTDate(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(date.getTime() + kstOffset);
  return kstDate.toISOString().split('T')[0]!;
}

/**
 * Get the week start and end dates (Monday to Sunday) in KST
 */
function getWeekDates(): { startDate: string; endDate: string } {
  const now = new Date();
  // KST offset (UTC+9)
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);

  const day = kstNow.getDay(); // 0 (Sunday) to 6 (Saturday)
  const diff = kstNow.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday

  const monday = new Date(kstNow);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Format dates directly from KST time
  const startDate = formatKSTDate(monday);
  const endDate = formatKSTDate(sunday);

  return { startDate, endDate };
}

/**
 * Get KST current date string
 */
function getKSTDateString(): string {
  return formatKSTDate(new Date());
}

/**
 * Get all active members with their ranking data
 */
async function getMemberRankings(): Promise<MemberRanking[]> {
  const db = getDb();

  // Get all active members with post counts
  const membersWithPosts = await db
    .select({
      memberId: members.id,
      name: members.name,
      nickname: members.nickname,
      discordUsername: members.discordUsername,
      postCount: count(posts.id),
    })
    .from(members)
    .leftJoin(posts, eq(members.id, posts.memberId))
    .where(eq(members.status, MemberStatus.ACTIVE))
    .groupBy(members.id);

  // Get activity scores for each member
  // P0 #5: 이번 주 기간 점수만 필터링
  const weekDates = getWeekDates();
  const weekStartDate = new Date(weekDates.startDate + 'T00:00:00.000+09:00');
  const weekEndDate = new Date(weekDates.endDate + 'T23:59:59.999+09:00');

  const scoreStats = await db
    .select({
      memberId: activityScores.memberId,
      totalScore: sql<number>`COALESCE(SUM(${activityScores.points}), 0)`,
      discordScore: sql<number>`COALESCE(SUM(CASE WHEN ${activityScores.type} IN (${ActivityScoreType.DISCORD_MESSAGE}, ${ActivityScoreType.DISCORD_THREAD}, ${ActivityScoreType.DISCORD_REACTION}) THEN ${activityScores.points} ELSE 0 END), 0)`,
    })
    .from(activityScores)
    .where(
      sql`${activityScores.createdAt} >= ${weekStartDate} AND ${activityScores.createdAt} <= ${weekEndDate}`
    )
    .groupBy(activityScores.memberId);

  // Create score maps
  const totalScoreMap = new Map<string, number>();
  const discordScoreMap = new Map<string, number>();

  for (const stat of scoreStats) {
    totalScoreMap.set(stat.memberId, Number(stat.totalScore));
    discordScoreMap.set(stat.memberId, Number(stat.discordScore));
  }

  // Build rankings
  const rankings: MemberRanking[] = membersWithPosts.map((member) => ({
    memberId: member.memberId,
    name: member.name,
    nickname: member.nickname,
    discordUsername: member.discordUsername,
    totalScore: totalScoreMap.get(member.memberId) ?? 0,
    postCount: Number(member.postCount),
    discordScore: discordScoreMap.get(member.memberId) ?? 0,
    rank: 0, // Will be set after sorting
  }));

  // Sort by total score (primary), then post count (secondary)
  rankings.sort((a, b) =>
    b.totalScore - a.totalScore || b.postCount - a.postCount
  );

  // Assign ranks
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });

  return rankings;
}

/**
 * Create Discord embed for weekly ranking
 */
function createRankingEmbed(rankings: MemberRanking[]): EmbedBuilder {
  const weekDates = getWeekDates();
  const today = getKSTDateString();

  // Format dates for display
  const startDateDisplay = weekDates.startDate.replace(/-/g, '.');
  const endDateDisplay = weekDates.endDate.replace(/-/g, '.');
  const todayDisplay = today.replace(/-/g, '.');

  const embed = new EmbedBuilder()
    .setTitle('🏆 주간 랭킹')
    .setDescription(
      `**기간:** ${startDateDisplay} ~ ${endDateDisplay}\n` +
      `**발송일:** ${todayDisplay} 22:00\n\n` +
      `${bold('활동 점수(총점)')}를 기준으로 정렬되었습니다.`
    )
    .setColor(0x0091FF) // Questing Blue
    .setTimestamp();

  // Add podium (top 3)
  const top3 = rankings.slice(0, 3);
  if (top3.length > 0) {
    let podiumText = '';

    const medals = ['🥇', '🥈', '🥉'];

    for (let i = 0; i < top3.length; i++) {
      const r = top3[i]!;
      const medal = medals[i] ?? '🏅';
      const name = r.nickname || r.name;
      const discordScore = r.discordScore > 0 ? ` | 디스코드 ${r.discordScore}점` : '';
      podiumText += `${medal} ${bold(name)} - 총 ${r.totalScore}점 (포스트 ${r.postCount}개${discordScore})\n`;
    }

    embed.addFields({
      name: '👑 포디움',
      value: podiumText || '등록된 멤버가 없습니다.',
      inline: false,
    });
  }

  // Add full rankings (top 15)
  const displayRankings = rankings.slice(0, 15);
  let rankingText = '';

  for (const r of displayRankings) {
    const name = r.nickname || r.name;
    const rankDisplay = r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] ?? `${r.rank}위` : `${r.rank}위`;
    const discordScore = r.discordScore > 0 ? ` | 디스코드 ${r.discordScore}점` : '';
    rankingText += `${rankDisplay} ${bold(name)} - 총 ${r.totalScore}점 (포스트 ${r.postCount}개${discordScore})\n`;
  }

  if (rankings.length > 15) {
    rankingText += `\n_외 ${rankings.length - 15}명_`;
  }

  embed.addFields({
    name: `📊 전체 랭킹 (총 ${rankings.length}명)`,
    value: rankingText || '등록된 멤버가 없습니다.',
    inline: false,
  });

  return embed;
}

/**
 * Weekly Ranking class for scheduling weekly ranking announcements
 */
export class WeeklyRanking {
  private runningLock = Promise.resolve();
  private client: Client | null = null;

  /**
   * Set the Discord client for sending notifications
   */
  setClient(client: Client): void {
    this.client = client;
  }

  /**
   * Get the Discord client
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Check if the scheduler is currently running
   */
  isSending(): boolean {
    // Check if there's an active lock
    return this.runningLock !== Promise.resolve();
  }

  /**
   * Send weekly ranking report
   */
  async sendWeeklyRanking(): Promise<WeeklyRankingResult> {
    // Wait for any existing run to complete
    await this.runningLock;

    // Create new lock
    let resolveLock: (() => void) | undefined;
    const currentLock = new Promise<void>(resolve => {
      resolveLock = resolve;
    });
    const previousLock = this.runningLock;
    this.runningLock = currentLock;

    const startTime = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!this.client) {
        throw new Error('Discord client not set');
      }

      console.log('[WeeklyRanking] Fetching member rankings...');

      // Get rankings
      const rankings = await getMemberRankings();

      if (rankings.length === 0) {
        console.log('[WeeklyRanking] No active members found');
        warnings.push('랭킹 기간에 활성 멤버가 없습니다');

        return {
          timestamp: startTime,
          rankingSent: false,
          totalMembers: 0,
          errors: [],
          warnings,
        };
      }

      console.log(`[WeeklyRanking] Found ${rankings.length} active members`);

      // Get ranking channel ID
      const channelId = await getConfigValue(ConfigKeys.RANKING_CHANNEL);

      if (!channelId) {
        throw new Error('Ranking channel not configured. Please set RANKING_CHANNEL in config.');
      }

      // Create embed
      const embed = createRankingEmbed(rankings);

      // Send to channel
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        throw new Error(`Invalid ranking channel: ${channelId}`);
      }

      await channel.send({ embeds: [embed] });

      console.log(`[WeeklyRanking] Weekly ranking sent successfully (${rankings.length} members)`);

      return {
        timestamp: startTime,
        rankingSent: true,
        totalMembers: rankings.length,
        errors,
        warnings,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[WeeklyRanking] Error: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        rankingSent: false,
        totalMembers: 0,
        errors,
        warnings,
      };
    } finally {
      // Release current lock
      if (resolveLock) {
        resolveLock();
      }
      // Restore previous lock state if it was different
      if (previousLock !== Promise.resolve()) {
        this.runningLock = previousLock;
      } else {
        this.runningLock = Promise.resolve();
      }
    }
  }
}

// Singleton instance
let weeklyRankingInstance: WeeklyRanking | null = null;

/**
 * Get the WeeklyRanking singleton instance
 */
export function getWeeklyRanking(): WeeklyRanking {
  if (!weeklyRankingInstance) {
    weeklyRankingInstance = new WeeklyRanking();
  }
  return weeklyRankingInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetWeeklyRanking(): void {
  weeklyRankingInstance = null;
}
