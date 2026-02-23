/**
 * /랭킹 명령어 - 누적 포스트 수 기준 랭킹 조회
 * 스터디원들의 누적 포스트 수와 출석률 기준 랭킹을 표시합니다.
 * Requirements: 9.3, 9.5
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../bot';
import { getMemberService } from '../services/member.service';
import { getPostService } from '../services/post.service';
import { getAttendanceService } from '../services/attendance.service';
import { MemberStatus, AttendanceStatus, type Member } from '@blog-study/shared/db';
import { getRankEmoji } from './constants';

/**
 * Ranking entry with member info and stats
 */
export interface RankingEntry {
  member: Member;
  postCount: number;
  attendanceRate: number;
  submittedRounds: number;
  totalRounds: number;
}

/**
 * Calculate ranking data for all members
 * Requirements: 9.3, 9.5 - Ranking by post count with attendance rate
 */
export async function calculateRankings(): Promise<RankingEntry[]> {
  const memberService = getMemberService();
  const postService = getPostService();
  const attendanceService = getAttendanceService();

  // Get all members (not just active, to show historical rankings)
  const allMembers = await memberService.getAll();

  // Filter to active and dormant members (exclude withdrawn for ranking)
  const eligibleMembers = allMembers.filter(
    (m) => m.status === MemberStatus.ACTIVE || m.status === MemberStatus.DORMANT
  );

  const rankings: RankingEntry[] = [];

  for (const member of eligibleMembers) {
    // Get post count
    const postCount = await postService.countByMember(member.id);

    // Get attendance records
    const attendanceRecords = await attendanceService.getByMember(member.id);

    // Calculate attendance rate
    const totalRounds = attendanceRecords.length;
    const submittedRounds = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.SUBMITTED || a.status === AttendanceStatus.LATE
    ).length;

    const attendanceRate = totalRounds > 0
      ? Math.round((submittedRounds / totalRounds) * 100)
      : 0;

    rankings.push({
      member,
      postCount,
      attendanceRate,
      submittedRounds,
      totalRounds,
    });
  }

  // Sort by post count descending, then by attendance rate descending
  rankings.sort((a, b) => {
    if (b.postCount !== a.postCount) {
      return b.postCount - a.postCount;
    }
    return b.attendanceRate - a.attendanceRate;
  });

  return rankings;
}

/**
 * Format ranking entry for display
 */
function formatRankingEntry(entry: RankingEntry, rank: number): string {
  const rankEmoji = getRankEmoji(rank);
  const statusEmoji = entry.member.status === MemberStatus.DORMANT ? ' 😴' : '';

  return `${rankEmoji} **${entry.member.name}**${statusEmoji} - ${entry.postCount}개 (출석률 ${entry.attendanceRate}%)`;
}

export const 랭킹Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('랭킹')
    .setDescription('누적 포스트 수 기준 랭킹을 조회합니다.')
    .addIntegerOption((option) =>
      option
        .setName('개수')
        .setDescription('표시할 랭킹 수 (기본: 10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const limit = interaction.options.getInteger('개수') || 10;

      // Calculate rankings
      const rankings = await calculateRankings();

      if (rankings.length === 0) {
        await interaction.reply({
          content: '📊 아직 랭킹 데이터가 없습니다.',
        });
        return;
      }

      // Get top N rankings
      const topRankings = rankings.slice(0, limit);

      // Calculate total posts
      const totalPosts = rankings.reduce((sum, r) => sum + r.postCount, 0);
      const avgPosts = rankings.length > 0
        ? (totalPosts / rankings.length).toFixed(1)
        : '0';

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0xffd700) // Gold color for rankings
        .setTitle('🏆 스터디 랭킹')
        .setDescription(
          [
            `총 **${rankings.length}명** 참가 | 총 **${totalPosts}개** 포스트`,
            `평균 포스트 수: **${avgPosts}개**`,
            '',
            '📊 **누적 포스트 수 기준**',
          ].join('\n')
        )
        .setTimestamp();

      // Format ranking list
      const rankingList = topRankings
        .map((entry, index) => formatRankingEntry(entry, index + 1))
        .join('\n');

      embed.addFields({
        name: `Top ${topRankings.length}`,
        value: rankingList || '데이터 없음',
        inline: false,
      });

      // Add footer with info
      if (rankings.length > limit) {
        embed.setFooter({
          text: `💡 /랭킹 개수:${rankings.length} 으로 전체 랭킹을 확인하세요`,
        });
      } else {
        embed.setFooter({
          text: '💡 출석률 = 제출 회차 / 전체 회차',
        });
      }

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error('Error in /랭킹 command:', error);
      await interaction.reply({
        content: '❌ 랭킹 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: false,
};
