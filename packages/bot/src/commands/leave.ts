/**
 * /탈퇴 명령어 - 스터디 탈퇴
 * 스터디에서 탈퇴합니다.
 * Requirements: 2.1, 2.2, 2.3
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { CommandHandler } from '../bot';
import { getMemberService, MemberError, MemberErrorCodes } from '../services/member.service';
import { STUDY_ROLE_NAME } from './constants';

export const 탈퇴Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('탈퇴')
    .setDescription('스터디에서 탈퇴합니다.') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const memberService = getMemberService();

    try {
      // Withdraw the member
      const member = await memberService.withdraw(interaction.user.id);

      // Try to remove the study role
      let roleRemoved = false;
      if (interaction.guild && interaction.member) {
        try {
          const role = interaction.guild.roles.cache.find(
            (r) => r.name === STUDY_ROLE_NAME
          );
          if (role && interaction.member instanceof Object && 'roles' in interaction.member) {
            const guildMember = interaction.member as GuildMember;
            await guildMember.roles.remove(role);
            roleRemoved = true;
          }
        } catch (roleError) {
          console.warn('Failed to remove study role:', roleError);
        }
      }

      // Build response message
      let response = `👋 **스터디 탈퇴 완료**\n\n`;
      response += `${member.name}님, 그동안 수고하셨습니다!\n`;
      response += `작성하신 글과 출석 기록은 보존됩니다.\n\n`;
      if (roleRemoved) {
        response += `✅ ${STUDY_ROLE_NAME} 역할이 제거되었습니다.\n`;
      }
      response += `\n다음에 또 함께해요! 🙏`;

      await interaction.reply({
        content: response,
      });
    } catch (error) {
      if (error instanceof MemberError) {
        if (error.code === MemberErrorCodes.USER_NOT_FOUND) {
          await interaction.reply({
            content: '❌ 등록되지 않은 사용자입니다.\n\n💡 스터디에 참가하려면 `/참가` 명령어를 사용하세요.',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `❌ ${error.userMessage}`,
            ephemeral: true,
          });
        }
      } else {
        console.error('Error in /탈퇴 command:', error);
        await interaction.reply({
          content: '❌ 탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          ephemeral: true,
        });
      }
    }
  },

  adminOnly: false,
};
