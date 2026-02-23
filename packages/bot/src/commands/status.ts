/**
 * /현황 명령어 - 현재 회차 출석 현황 조회
 * 현재 회차의 출석 현황과 마감까지 남은 일수를 표시합니다.
 * Requirements: 9.1, 9.2
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../bot';
import { getAttendanceService } from '../services/attendance.service';
import { getMemberService } from '../services/member.service';
import { getCurrentRound } from '../services/round.service';
import { AttendanceStatus, type Member } from '@blog-study/shared/db';
import { getDaysUntilDeadline, getDaysUntilGraceEnd, type RoundDates } from '@blog-study/shared/utils';

// Status display mapping
const STATUS_EMOJI: Record<string, string> = {
  [AttendanceStatus.SUBMITTED]: '✅',
  [AttendanceStatus.PENDING]: '⏳',
  [AttendanceStatus.LATE]: '⚠️',
  [AttendanceStatus.ABSENT]: '❌',
};

const STATUS_TEXT: Record<string, string> = {
  [AttendanceStatus.SUBMITTED]: '제출완료',
  [AttendanceStatus.PENDING]: '미제출',
  [AttendanceStatus.LATE]: '지각',
  [AttendanceStatus.ABSENT]: '결석',
};

/**
 * Format member attendance for display
 */
function formatMemberStatus(
  member: Member,
  status: string
): string {
  const emoji = STATUS_EMOJI[status] || '❓';
  const statusText = STATUS_TEXT[status] || status;
  return `${emoji} **${member.name}** (${member.part}) - ${statusText}`;
}

/**
 * Calculate remaining days info
 */
function getRemainingDaysInfo(round: { startDate: string; endDate: string; graceEndDate: string; roundNumber: number }): string {
  const now = new Date();
  const roundDates: RoundDates = {
    roundNumber: round.roundNumber,
    startDate: new Date(round.startDate + 'T00:00:00.000Z'),
    endDate: new Date(round.endDate + 'T23:59:59.999Z'),
    graceEndDate: new Date(round.graceEndDate + 'T23:59:59.999Z'),
  };

  const daysUntilDeadline = getDaysUntilDeadline(roundDates, now);
  const daysUntilGraceEnd = getDaysUntilGraceEnd(roundDates, now);

  if (daysUntilDeadline > 0) {
    return `📅 마감까지 **${daysUntilDeadline}일** 남음`;
  } else if (daysUntilGraceEnd > 0) {
    return `⚠️ 지각 마감까지 **${daysUntilGraceEnd}일** 남음 (지각 기간)`;
  } else {
    return `🔒 마감 완료`;
  }
}

export const 현황Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('현황')
    .setDescription('현재 회차의 출석 현황을 조회합니다.') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Get current round
      const currentRound = await getCurrentRound();

      // Get all active members
      const memberService = getMemberService();
      const activeMembers = await memberService.getAllActive();

      // Get attendance records for current round
      const attendanceService = getAttendanceService();
      const attendanceRecords = await attendanceService.getByRound(currentRound.id);

      // Create a map of member ID to attendance status
      const attendanceMap = new Map<string, string>();
      for (const record of attendanceRecords) {
        attendanceMap.set(record.memberId, record.status);
      }

      // Group members by attendance status
      const submitted: Member[] = [];
      const pending: Member[] = [];
      const late: Member[] = [];
      const absent: Member[] = [];

      for (const member of activeMembers) {
        const status = attendanceMap.get(member.id) || AttendanceStatus.PENDING;

        switch (status) {
          case AttendanceStatus.SUBMITTED:
            submitted.push(member);
            break;
          case AttendanceStatus.LATE:
            late.push(member);
            break;
          case AttendanceStatus.ABSENT:
            absent.push(member);
            break;
          default:
            pending.push(member);
            break;
        }
      }

      // Calculate statistics
      const totalActive = activeMembers.length;
      const submittedCount = submitted.length + late.length; // Both submitted and late count as submitted
      const submissionRate = totalActive > 0 ? Math.round((submittedCount / totalActive) * 100) : 0;

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 ${currentRound.roundNumber}회차 출석 현황`)
        .setDescription(
          [
            getRemainingDaysInfo(currentRound),
            '',
            `📈 제출률: **${submissionRate}%** (${submittedCount}/${totalActive}명)`,
          ].join('\n')
        )
        .setTimestamp();

      // Add submitted members
      if (submitted.length > 0) {
        const submittedList = submitted
          .map((m) => formatMemberStatus(m, AttendanceStatus.SUBMITTED))
          .join('\n');
        embed.addFields({
          name: `✅ 제출완료 (${submitted.length}명)`,
          value: submittedList.length <= 1024 ? submittedList : submittedList.slice(0, 1000) + '...',
          inline: false,
        });
      }

      // Add pending members
      if (pending.length > 0) {
        const pendingList = pending
          .map((m) => formatMemberStatus(m, AttendanceStatus.PENDING))
          .join('\n');
        embed.addFields({
          name: `⏳ 미제출 (${pending.length}명)`,
          value: pendingList.length <= 1024 ? pendingList : pendingList.slice(0, 1000) + '...',
          inline: false,
        });
      }

      // Add late members
      if (late.length > 0) {
        const lateList = late
          .map((m) => formatMemberStatus(m, AttendanceStatus.LATE))
          .join('\n');
        embed.addFields({
          name: `⚠️ 지각 (${late.length}명)`,
          value: lateList.length <= 1024 ? lateList : lateList.slice(0, 1000) + '...',
          inline: false,
        });
      }

      // Add absent members
      if (absent.length > 0) {
        const absentList = absent
          .map((m) => formatMemberStatus(m, AttendanceStatus.ABSENT))
          .join('\n');
        embed.addFields({
          name: `❌ 결석 (${absent.length}명)`,
          value: absentList.length <= 1024 ? absentList : absentList.slice(0, 1000) + '...',
          inline: false,
        });
      }

      // Add round info footer
      embed.setFooter({
        text: `기간: ${currentRound.startDate} ~ ${currentRound.endDate} | 지각 마감: ${currentRound.graceEndDate}`,
      });

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error('Error in /현황 command:', error);
      await interaction.reply({
        content: '❌ 현황 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: false,
};
