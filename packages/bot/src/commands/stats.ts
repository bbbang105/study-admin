/**
 * /통계 명령어 - 회차별 통계 조회
 * 회차별 제출률, 지각률, 결석률을 표시합니다.
 * Requirements: 9.4
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../bot';
import { getAttendanceService } from '../services/attendance.service';
import { getPostService } from '../services/post.service';
import { getMemberService } from '../services/member.service';
import { getCurrentRound, getRoundByNumber } from '../services/round.service';
import { AttendanceStatus, type Round } from '@blog-study/shared/db';

/**
 * Round statistics
 */
export interface RoundStatistics {
  roundNumber: number;
  totalMembers: number;
  submittedCount: number;
  lateCount: number;
  absentCount: number;
  pendingCount: number;
  submissionRate: number;
  lateRate: number;
  absentRate: number;
  totalPosts: number;
  topContributors: Array<{ name: string; postCount: number }>;
}

/**
 * Calculate statistics for a specific round
 * Requirements: 9.4 - Round statistics calculation
 */
export async function calculateRoundStatistics(
  roundId: number,
  roundNumber: number
): Promise<RoundStatistics> {
  const attendanceService = getAttendanceService();
  const postService = getPostService();
  const memberService = getMemberService();

  // Get attendance records for the round
  const attendanceRecords = await attendanceService.getByRound(roundId);

  // Get posts for the round
  const posts = await postService.getByRound(roundId);

  // Count by status
  let submittedCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let pendingCount = 0;

  for (const record of attendanceRecords) {
    switch (record.status) {
      case AttendanceStatus.SUBMITTED:
        submittedCount++;
        break;
      case AttendanceStatus.LATE:
        lateCount++;
        break;
      case AttendanceStatus.ABSENT:
        absentCount++;
        break;
      default:
        pendingCount++;
        break;
    }
  }

  const totalMembers = attendanceRecords.length;

  // Calculate rates
  const submissionRate = totalMembers > 0
    ? Math.round(((submittedCount + lateCount) / totalMembers) * 100)
    : 0;
  const lateRate = totalMembers > 0
    ? Math.round((lateCount / totalMembers) * 100)
    : 0;
  const absentRate = totalMembers > 0
    ? Math.round((absentCount / totalMembers) * 100)
    : 0;

  // Calculate top contributors (members with most posts in this round)
  const postCountByMember = new Map<string, number>();
  for (const post of posts) {
    const current = postCountByMember.get(post.memberId) || 0;
    postCountByMember.set(post.memberId, current + 1);
  }

  // Get member names and sort by post count
  const topContributors: Array<{ name: string; postCount: number }> = [];
  for (const [memberId, postCount] of postCountByMember) {
    const member = await memberService.getById(memberId);
    if (member) {
      topContributors.push({ name: member.name, postCount });
    }
  }
  topContributors.sort((a, b) => b.postCount - a.postCount);

  return {
    roundNumber,
    totalMembers,
    submittedCount,
    lateCount,
    absentCount,
    pendingCount,
    submissionRate,
    lateRate,
    absentRate,
    totalPosts: posts.length,
    topContributors: topContributors.slice(0, 3), // Top 3
  };
}

/**
 * Format percentage with bar visualization
 */
function formatPercentageBar(rate: number, emoji: string): string {
  const filled = Math.round(rate / 10);
  const empty = 10 - filled;
  const bar = emoji.repeat(filled) + '░'.repeat(empty);
  return `${bar} ${rate}%`;
}

export const 통계Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('통계')
    .setDescription('회차별 통계를 조회합니다.')
    .addIntegerOption((option) =>
      option
        .setName('회차')
        .setDescription('조회할 회차 번호 (미입력 시 현재 회차)')
        .setRequired(false)
        .setMinValue(1)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const roundNumberInput = interaction.options.getInteger('회차');

      let round: Round;

      if (roundNumberInput) {
        // Get specific round
        const foundRound = await getRoundByNumber(roundNumberInput);
        if (!foundRound) {
          await interaction.reply({
            content: `❌ ${roundNumberInput}회차를 찾을 수 없습니다.`,
            ephemeral: true,
          });
          return;
        }
        round = foundRound;
      } else {
        // Get current round
        round = await getCurrentRound();
      }

      // Calculate statistics
      const stats = await calculateRoundStatistics(round.id, round.roundNumber);

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📈 ${stats.roundNumber}회차 통계`)
        .setDescription(
          [
            `📅 기간: ${round.startDate} ~ ${round.endDate}`,
            `👥 참가자: **${stats.totalMembers}명** | 📝 포스트: **${stats.totalPosts}개**`,
          ].join('\n')
        )
        .setTimestamp();

      // Add submission rate
      embed.addFields({
        name: '✅ 제출률',
        value: formatPercentageBar(stats.submissionRate, '🟩'),
        inline: true,
      });

      // Add late rate
      embed.addFields({
        name: '⚠️ 지각률',
        value: formatPercentageBar(stats.lateRate, '🟨'),
        inline: true,
      });

      // Add absent rate
      embed.addFields({
        name: '❌ 결석률',
        value: formatPercentageBar(stats.absentRate, '🟥'),
        inline: true,
      });

      // Add detailed counts
      embed.addFields({
        name: '📊 상세 현황',
        value: [
          `✅ 제출: ${stats.submittedCount}명`,
          `⚠️ 지각: ${stats.lateCount}명`,
          `❌ 결석: ${stats.absentCount}명`,
          `⏳ 미제출: ${stats.pendingCount}명`,
        ].join(' | '),
        inline: false,
      });

      // Add top contributors if any
      if (stats.topContributors.length > 0) {
        const topList = stats.topContributors
          .map((c, i) => {
            const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            return `${emoji} ${c.name} (${c.postCount}개)`;
          })
          .join('\n');

        embed.addFields({
          name: '🏆 이번 회차 MVP',
          value: topList,
          inline: false,
        });
      }

      // Add footer
      embed.setFooter({
        text: '💡 /통계 회차:N 으로 특정 회차 통계를 확인하세요',
      });

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error('Error in /통계 command:', error);
      await interaction.reply({
        content: '❌ 통계 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: false,
};
