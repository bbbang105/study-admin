/**
 * /휴면해제 명령어 - 멤버 휴면 해제 (관리자 전용)
 * 휴면 상태의 멤버를 활동 상태로 변경합니다.
 * Requirements: 3.6, 3.8
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../../bot';
import { getMemberService, MemberError, MemberErrorCodes } from '../../services/member.service';

export const 휴면해제Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('휴면해제')
    .setDescription('[관리자] 멤버의 휴면 상태를 해제합니다.')
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('휴면 해제할 멤버')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('유저', true);
    const memberService = getMemberService();

    try {
      const member = await memberService.unsetDormant(targetUser.id);

      await interaction.reply({
        content: [
          `✅ **휴면 해제 완료**`,
          ``,
          `👤 **대상:** ${member.name} (<@${targetUser.id}>)`,
          `📊 **상태:** 활동중`,
          ``,
          `💡 이제부터 출석 체크가 적용됩니다.`,
        ].join('\n'),
      });
    } catch (error) {
      if (error instanceof MemberError) {
        let errorMessage = `❌ ${error.userMessage}`;

        if (error.code === MemberErrorCodes.USER_NOT_FOUND) {
          errorMessage = `❌ <@${targetUser.id}>님은 스터디에 등록되지 않은 사용자입니다.`;
        } else if (error.code === MemberErrorCodes.NOT_DORMANT) {
          errorMessage = `❌ <@${targetUser.id}>님은 휴면 상태가 아닙니다.`;
        }

        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });
      } else {
        console.error('Error in /휴면해제 command:', error);
        await interaction.reply({
          content: '❌ 휴면 해제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          ephemeral: true,
        });
      }
    }
  },

  adminOnly: true,
};
