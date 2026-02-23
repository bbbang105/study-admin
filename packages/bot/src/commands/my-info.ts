/**
 * /내정보 명령어 - 내 참가 정보 조회
 * 내 스터디 참가 정보를 조회합니다.
 * Requirements: 4.1, 4.2
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../bot';
import { getMemberService, MemberError } from '../services/member.service';
import { MemberStatus } from '@blog-study/shared/db';

// Status display mapping
const STATUS_DISPLAY: Record<string, string> = {
  [MemberStatus.ACTIVE]: '✅ 활동중',
  [MemberStatus.DORMANT]: '😴 휴면중',
  [MemberStatus.WITHDRAWN]: '👋 탈퇴',
};

export const 내정보Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('내정보')
    .setDescription('내 스터디 참가 정보를 조회합니다.') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const memberService = getMemberService();

    try {
      const member = await memberService.getByDiscordId(interaction.user.id);

      if (!member) {
        await interaction.reply({
          content: '❌ 등록되지 않은 사용자입니다.\n\n💡 스터디에 참가하려면 `/참가` 명령어를 사용하세요.',
          ephemeral: true,
        });
        return;
      }

      // Build embed message
      const embed = new EmbedBuilder()
        .setColor(member.status === MemberStatus.ACTIVE ? 0x00ff00 : 0xffaa00)
        .setTitle(`📋 ${member.name}님의 스터디 정보`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          {
            name: '👤 기본 정보',
            value: [
              `**이름:** ${member.name}`,
              `**파트:** ${member.part}`,
              `**상태:** ${STATUS_DISPLAY[member.status] || member.status}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '📝 블로그',
            value: [
              `**URL:** ${member.blogUrl}`,
              `**RSS:** ${member.rssUrl || '자동 감지 예정'}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '📊 활동 정보',
            value: [
              `**가입일:** ${member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('ko-KR') : '알 수 없음'}`,
              `**휴면 사용:** ${member.dormantUsed ? '사용함' : '미사용'}`,
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({
          text: '💡 /현황 명령어로 현재 회차 출석 현황을 확인하세요',
        })
        .setTimestamp();

      // Add dormant info if applicable
      if (member.status === MemberStatus.DORMANT && member.dormantStartRound) {
        embed.addFields({
          name: '😴 휴면 정보',
          value: [
            `**시작 회차:** ${member.dormantStartRound}회차`,
            `**종료 예정:** ${member.dormantStartRound + 4}회차`,
          ].join('\n'),
          inline: false,
        });
      }

      // TODO: Add post count and fine info when those services are implemented
      // This will be added in later tasks

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      if (error instanceof MemberError) {
        await interaction.reply({
          content: `❌ ${error.userMessage}`,
          ephemeral: true,
        });
      } else {
        console.error('Error in /내정보 command:', error);
        await interaction.reply({
          content: '❌ 정보 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          ephemeral: true,
        });
      }
    }
  },

  adminOnly: false,
};
