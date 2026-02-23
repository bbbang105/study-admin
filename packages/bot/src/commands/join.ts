/**
 * /참가 명령어 - 스터디 참가 등록
 * 블로그 URL로 스터디에 참가 등록합니다.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { CommandHandler } from '../bot';
import { getMemberService, MemberError, MemberErrorCodes } from '../services/member.service';
import { STUDY_ROLE_NAME } from './constants';

// Welcome message template
const WELCOME_MESSAGE = `
🎉 **스터디 참가를 환영합니다!**

📋 **스터디 규칙 안내**
• 총 10회차로 진행됩니다 (각 회차는 2주)
• 월요일 시작 → 2주 뒤 일요일 마감
• 마감 다음날(월요일) 제출 시 지각 (벌금 3,000원)
• 마감 다음날 이후(화요일~) 미제출 시 결석 (벌금 5,000원)
• 휴면은 1회만 가능, 최대 4회차(8주) 동안 면제

📝 **명령어 안내**
• \`/내정보\` - 내 참가 정보 확인
• \`/현황\` - 현재 회차 출석 현황
• \`/랭킹\` - 포스트 수 랭킹
• \`/탈퇴\` - 스터디 탈퇴

열심히 글 써봐요! 💪
`;

export const 참가Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('참가')
    .setDescription('블로그 URL로 스터디에 참가 등록합니다.')
    .addStringOption((option) =>
      option
        .setName('블로그url')
        .setDescription('블로그 주소 (예: https://velog.io/@username)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('이름')
        .setDescription('실명 (예: 홍길동)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('파트')
        .setDescription('담당 파트')
        .setRequired(true)
        .addChoices(
          { name: 'Frontend', value: 'frontend' },
          { name: 'Backend', value: 'backend' },
          { name: 'Fullstack', value: 'fullstack' },
          { name: 'Design', value: 'design' },
          { name: 'PM', value: 'pm' },
          { name: 'DevOps', value: 'devops' },
          { name: 'Other', value: 'other' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('rss_url')
        .setDescription('RSS 피드 URL (자동 감지 실패 시 직접 입력)')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const blogUrl = interaction.options.getString('블로그url', true);
    const name = interaction.options.getString('이름', true);
    const part = interaction.options.getString('파트', true);
    const rssUrl = interaction.options.getString('rss_url') || undefined;

    const memberService = getMemberService();

    try {
      // Register the member
      const member = await memberService.register({
        discordId: interaction.user.id,
        discordUsername: interaction.user.username,
        name,
        part,
        blogUrl,
        rssUrl,
      });

      // Try to assign the study role
      let roleAssigned = false;
      if (interaction.guild && interaction.member) {
        try {
          const role = interaction.guild.roles.cache.find(
            (r) => r.name === STUDY_ROLE_NAME
          );
          if (role && interaction.member instanceof Object && 'roles' in interaction.member) {
            const guildMember = interaction.member as GuildMember;
            await guildMember.roles.add(role);
            roleAssigned = true;
          }
        } catch (roleError) {
          console.warn('Failed to assign study role:', roleError);
        }
      }

      // Build response message
      let response = `✅ **스터디 참가 등록 완료!**\n\n`;
      response += `📝 **등록 정보**\n`;
      response += `• 이름: ${member.name}\n`;
      response += `• 파트: ${member.part}\n`;
      response += `• 블로그: ${member.blogUrl}\n`;
      if (member.rssUrl) {
        response += `• RSS: ${member.rssUrl}\n`;
      } else {
        response += `• RSS: 자동 감지 예정\n`;
      }
      if (roleAssigned) {
        response += `• 역할: ${STUDY_ROLE_NAME} 부여됨\n`;
      }
      response += WELCOME_MESSAGE;

      await interaction.reply({
        content: response,
      });
    } catch (error) {
      if (error instanceof MemberError) {
        let errorMessage = `❌ ${error.userMessage}`;

        if (error.code === MemberErrorCodes.INVALID_URL) {
          errorMessage += '\n\n💡 올바른 블로그 URL 형식:\n';
          errorMessage += '• Velog: `https://velog.io/@username`\n';
          errorMessage += '• Tistory: `https://blogname.tistory.com`\n';
          errorMessage += '• Medium: `https://medium.com/@username`\n';
          errorMessage += '• 기타: `https://your-blog.com`';
        }

        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });
      } else {
        console.error('Error in /참가 command:', error);
        await interaction.reply({
          content: '❌ 참가 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          ephemeral: true,
        });
      }
    }
  },

  adminOnly: false,
};
