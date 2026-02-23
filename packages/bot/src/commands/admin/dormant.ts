/**
 * /휴면 명령어 - 멤버 휴면 설정 (관리자 전용)
 * 특정 멤버를 휴면 상태로 설정합니다.
 * Requirements: 3.1, 3.2, 3.3, 3.8
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../../bot';
import { getMemberService, MemberError, MemberErrorCodes } from '../../services/member.service';

// TODO: Get current round from RoundService when implemented
const CURRENT_ROUND = 1; // Placeholder

export const 휴면Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('휴면')
    .setDescription('[관리자] 멤버를 휴면 상태로 설정합니다.')
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('휴면 설정할 멤버')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('유저', true);
    const memberService = getMemberService();

    try {
      const member = await memberService.setDormant(targetUser.id, CURRENT_ROUND);

      await interaction.reply({
        content: [
          `✅ **휴면 설정 완료**`,
          ``,
          `👤 **대상:** ${member.name} (<@${targetUser.id}>)`,
          `📅 **시작 회차:** ${CURRENT_ROUND}회차`,
          `⏰ **종료 예정:** ${CURRENT_ROUND + 4}회차 (4회차 후 자동 해제)`,
          ``,
          `💡 휴면 기간 동안 출석 체크가 면제됩니다.`,
          `💡 조기 해제하려면 \`/휴면해제\` 명령어를 사용하세요.`,
        ].join('\n'),
      });
    } catch (error) {
      if (error instanceof MemberError) {
        let errorMessage = `❌ ${error.userMessage}`;

        if (error.code === MemberErrorCodes.USER_NOT_FOUND) {
          errorMessage = `❌ <@${targetUser.id}>님은 스터디에 등록되지 않은 사용자입니다.`;
        } else if (error.code === MemberErrorCodes.DORMANT_ALREADY_USED) {
          errorMessage = `❌ <@${targetUser.id}>님은 이미 휴면을 사용했습니다.\n\n💡 휴면은 스터디 기간 중 1회만 사용할 수 있습니다.`;
        } else if (error.code === MemberErrorCodes.ALREADY_DORMANT) {
          errorMessage = `❌ <@${targetUser.id}>님은 이미 휴면 상태입니다.`;
        }

        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });
      } else {
        console.error('Error in /휴면 command:', error);
        await interaction.reply({
          content: '❌ 휴면 설정 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          ephemeral: true,
        });
      }
    }
  },

  adminOnly: true,
};
