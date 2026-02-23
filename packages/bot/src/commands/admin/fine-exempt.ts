/**
 * /벌금면제 명령어 - 특정 유저의 벌금 면제 (관리자 전용)
 * Requirements: 15.7
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../../bot';
import { getMemberService } from '../../services/member.service';
import { getFineService, formatFineReason } from '../../services/fine.service';

export const 벌금면제Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('벌금면제')
    .setDescription('[관리자] 특정 유저의 벌금을 면제합니다.')
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('벌금을 면제할 멤버')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('회차')
        .setDescription('면제할 회차 번호')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('유저', true);
    const roundNumber = interaction.options.getInteger('회차', true);
    const memberService = getMemberService();
    const fineService = getFineService();

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

      // Find and waive the fine
      // Note: We need to find the round ID from round number
      // For now, we'll use roundNumber as roundId (assuming they match)
      const fine = await fineService.waiveByMemberAndRound(member.id, roundNumber);

      if (!fine) {
        await interaction.reply({
          content: `❌ <@${targetUser.id}>님의 ${roundNumber}회차 벌금을 찾을 수 없습니다.`,
          ephemeral: true,
        });
        return;
      }

      const reason = formatFineReason(fine.type as 'late' | 'absent');

      await interaction.reply({
        content: [
          `✅ **벌금 면제 완료**`,
          ``,
          `👤 **대상:** ${member.name} (<@${targetUser.id}>)`,
          `📅 **회차:** ${roundNumber}회차`,
          `📝 **사유:** ${reason}`,
          `💵 **금액:** ${fine.amount.toLocaleString()}원`,
          ``,
          `💡 해당 벌금이 면제 처리되었습니다.`,
        ].join('\n'),
      });
    } catch (error) {
      console.error('Error in /벌금면제 command:', error);
      await interaction.reply({
        content: '❌ 벌금 면제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: true,
};
