/**
 * /출석수정 명령어 - 출석 상태 수동 수정 (관리자 전용)
 * Requirements: 15.6
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../../bot';
import { getMemberService } from '../../services/member.service';
import { getAttendanceService } from '../../services/attendance.service';
import { getRoundByNumber } from '../../services/round.service';
import { AttendanceStatus, type AttendanceStatusType } from '@blog-study/shared/db';

/**
 * Map Korean status names to AttendanceStatus values
 */
const statusMap: Record<string, AttendanceStatusType> = {
  '출석': AttendanceStatus.SUBMITTED,
  '지각': AttendanceStatus.LATE,
  '결석': AttendanceStatus.ABSENT,
  '대기': AttendanceStatus.PENDING,
};

/**
 * Get Korean status name from AttendanceStatus value
 */
function getStatusName(status: AttendanceStatusType): string {
  switch (status) {
    case AttendanceStatus.SUBMITTED:
      return '출석';
    case AttendanceStatus.LATE:
      return '지각';
    case AttendanceStatus.ABSENT:
      return '결석';
    case AttendanceStatus.PENDING:
      return '대기';
    default:
      return status;
  }
}

/**
 * Get status emoji
 */
function getStatusEmoji(status: AttendanceStatusType): string {
  switch (status) {
    case AttendanceStatus.SUBMITTED:
      return '✅';
    case AttendanceStatus.LATE:
      return '⏰';
    case AttendanceStatus.ABSENT:
      return '❌';
    case AttendanceStatus.PENDING:
      return '⏳';
    default:
      return '❓';
  }
}

export const 출석수정Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('출석수정')
    .setDescription('[관리자] 특정 유저의 출석 상태를 수정합니다.')
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('출석을 수정할 멤버')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('회차')
        .setDescription('수정할 회차 번호')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(52)
    )
    .addStringOption((option) =>
      option
        .setName('상태')
        .setDescription('변경할 출석 상태')
        .setRequired(true)
        .addChoices(
          { name: '출석', value: '출석' },
          { name: '지각', value: '지각' },
          { name: '결석', value: '결석' },
          { name: '대기', value: '대기' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('유저', true);
    const roundNumber = interaction.options.getInteger('회차', true);
    const statusKorean = interaction.options.getString('상태', true);

    const memberService = getMemberService();
    const attendanceService = getAttendanceService();

    try {
      // Get member info
      const member = await memberService.getByDiscordId(targetUser.id);
      if (!member) {
        await interaction.reply({
          content: `❌ <@${targetUser.id}>님은 스터디에 등록되지 않은 사용자입니다.`,
          ephemeral: true,
        });
        return;
      }

      // Get round info
      const round = await getRoundByNumber(roundNumber);
      if (!round) {
        await interaction.reply({
          content: `❌ ${roundNumber}회차를 찾을 수 없습니다.`,
          ephemeral: true,
        });
        return;
      }

      // Get the new status
      const newStatus = statusMap[statusKorean];
      if (!newStatus) {
        await interaction.reply({
          content: `❌ 알 수 없는 상태입니다: ${statusKorean}`,
          ephemeral: true,
        });
        return;
      }

      // Get current attendance status
      const currentAttendance = await attendanceService.getByMemberAndRound(member.id, round.id);
      const previousStatus = currentAttendance?.status as AttendanceStatusType | undefined;

      // Update attendance status
      await attendanceService.updateStatus(
        member.id,
        round.id,
        newStatus
      );

      const previousStatusName = previousStatus ? getStatusName(previousStatus) : '없음';
      const newStatusName = getStatusName(newStatus);
      const statusEmoji = getStatusEmoji(newStatus);

      await interaction.reply({
        content: [
          `✅ **출석 상태 수정 완료**`,
          ``,
          `👤 **대상:** ${member.name} (<@${targetUser.id}>)`,
          `📅 **회차:** ${roundNumber}회차`,
          ``,
          `📝 **상태 변경:**`,
          `- 이전: ${previousStatusName}`,
          `- 변경: ${statusEmoji} ${newStatusName}`,
          ``,
          `💡 출석 상태가 수정되었습니다.`,
          newStatus === AttendanceStatus.LATE || newStatus === AttendanceStatus.ABSENT
            ? `⚠️ 지각/결석으로 변경 시 벌금은 자동으로 생성되지 않습니다. 필요시 별도로 처리해주세요.`
            : '',
        ].filter(Boolean).join('\n'),
      });
    } catch (error) {
      console.error('Error in /출석수정 command:', error);

      // Check if it's an attendance not found error
      if (error instanceof Error && error.message.includes('출석 기록을 찾을 수 없습니다')) {
        await interaction.reply({
          content: `❌ <@${targetUser.id}>님의 ${roundNumber}회차 출석 기록이 없습니다. 해당 회차가 시작되지 않았거나 멤버가 해당 회차에 참가하지 않았을 수 있습니다.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: '❌ 출석 수정 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: true,
};
