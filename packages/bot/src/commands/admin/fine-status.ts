/**
 * /벌금현황 명령어 - 특정 유저의 미납 벌금 조회 (관리자 전용)
 * Requirements: 8.5, 8.7
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { CommandHandler } from '../../bot';
import { getMemberService } from '../../services/member.service';
import { getFineService, formatFineReason } from '../../services/fine.service';

export const 벌금현황Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('벌금현황')
    .setDescription('[관리자] 특정 유저의 미납 벌금을 조회합니다.')
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('벌금 현황을 조회할 멤버')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('유저', true);
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

      // Get unpaid fines
      const unpaidFines = await fineService.getUnpaidByMember(member.id);
      const totalAmount = unpaidFines.reduce((sum, fine) => sum + fine.amount, 0);

      if (unpaidFines.length === 0) {
        await interaction.reply({
          content: `✅ <@${targetUser.id}>님은 미납 벌금이 없습니다.`,
        });
        return;
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle(`💰 ${member.name}님의 벌금 현황`)
        .setColor(0xff6b6b)
        .setDescription(`총 ${unpaidFines.length}건의 미납 벌금이 있습니다.`)
        .addFields(
          ...unpaidFines.map((fine, index) => ({
            name: `${index + 1}. ${formatFineReason(fine.type as 'late' | 'absent')}`,
            value: `💵 ${fine.amount.toLocaleString()}원\n📅 ${fine.createdAt ? new Date(fine.createdAt).toLocaleDateString('ko-KR') : '알 수 없음'}`,
            inline: true,
          })),
          {
            name: '📊 총 미납 금액',
            value: `**${totalAmount.toLocaleString()}원**`,
            inline: false,
          }
        )
        .setFooter({ text: `Discord ID: ${targetUser.id}` })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error('Error in /벌금현황 command:', error);
      await interaction.reply({
        content: '❌ 벌금 현황 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: true,
};
