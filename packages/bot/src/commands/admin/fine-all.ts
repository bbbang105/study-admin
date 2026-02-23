/**
 * /벌금전체 명령어 - 전체 미납 벌금 조회 (관리자 전용)
 * Requirements: 8.6, 8.7
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { CommandHandler } from '../../bot';
import { getFineService } from '../../services/fine.service';

export const 벌금전체Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('벌금전체')
    .setDescription('[관리자] 전체 미납 벌금을 조회합니다.') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const fineService = getFineService();

    try {
      // Get all unpaid fines grouped by member
      const groupedFines = await fineService.getAllUnpaidGroupedByMember();

      if (groupedFines.length === 0) {
        await interaction.reply({
          content: '✅ 현재 미납 벌금이 없습니다.',
        });
        return;
      }

      // Calculate total
      const totalAmount = groupedFines.reduce((sum, group) => sum + group.totalAmount, 0);
      const totalFines = groupedFines.reduce((sum, group) => sum + group.fines.length, 0);

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle('💰 전체 미납 벌금 현황')
        .setColor(0xff6b6b)
        .setDescription(`총 ${groupedFines.length}명, ${totalFines}건의 미납 벌금이 있습니다.`)
        .addFields(
          ...groupedFines.slice(0, 25).map((group) => ({
            name: `👤 ${group.discordUsername}`,
            value: [
              `<@${group.discordId}>`,
              `📝 ${group.fines.length}건`,
              `💵 ${group.totalAmount.toLocaleString()}원`,
            ].join('\n'),
            inline: true,
          }))
        )
        .addFields({
          name: '📊 총 미납 금액',
          value: `**${totalAmount.toLocaleString()}원**`,
          inline: false,
        })
        .setFooter({ text: `총 ${groupedFines.length}명` })
        .setTimestamp();

      // If there are more than 25 members, add a note
      if (groupedFines.length > 25) {
        embed.setDescription(
          `총 ${groupedFines.length}명, ${totalFines}건의 미납 벌금이 있습니다.\n⚠️ 상위 25명만 표시됩니다.`
        );
      }

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error('Error in /벌금전체 command:', error);
      await interaction.reply({
        content: '❌ 벌금 현황 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: true,
};
