/**
 * /참가자목록 명령어 - 전체 참가자 목록 조회
 * 스터디 참가자 목록을 상태별로 그룹화하여 표시합니다.
 * Requirements: 4.3, 4.4
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../bot';
import { getMemberService } from '../services/member.service';
import { MemberStatus, type Member } from '@blog-study/shared/db';

// Status display mapping
const STATUS_EMOJI: Record<string, string> = {
  [MemberStatus.ACTIVE]: '✅',
  [MemberStatus.DORMANT]: '😴',
  [MemberStatus.WITHDRAWN]: '👋',
};

const STATUS_TITLE: Record<string, string> = {
  [MemberStatus.ACTIVE]: '활동중',
  [MemberStatus.DORMANT]: '휴면중',
  [MemberStatus.WITHDRAWN]: '탈퇴',
};

/**
 * Format member list for display
 */
function formatMemberList(members: Member[]): string {
  if (members.length === 0) {
    return '없음';
  }

  return members
    .map((m, i) => `${i + 1}. **${m.name}** (${m.part}) - [블로그](${m.blogUrl})`)
    .join('\n');
}

export const 참가자목록Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('참가자목록')
    .setDescription('스터디 참가자 목록을 조회합니다.')
    .addStringOption((option) =>
      option
        .setName('상태')
        .setDescription('특정 상태의 참가자만 조회')
        .setRequired(false)
        .addChoices(
          { name: '전체', value: 'all' },
          { name: '활동중', value: MemberStatus.ACTIVE },
          { name: '휴면중', value: MemberStatus.DORMANT },
          { name: '탈퇴', value: MemberStatus.WITHDRAWN }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const memberService = getMemberService();
    const statusFilter = interaction.options.getString('상태') || 'all';

    try {
      const allMembers = await memberService.getAll();

      // Group members by status
      const activeMembers: Member[] = [];
      const dormantMembers: Member[] = [];
      const withdrawnMembers: Member[] = [];

      for (const member of allMembers) {
        if (member.status === MemberStatus.ACTIVE) {
          activeMembers.push(member);
        } else if (member.status === MemberStatus.DORMANT) {
          dormantMembers.push(member);
        } else if (member.status === MemberStatus.WITHDRAWN) {
          withdrawnMembers.push(member);
        }
      }

      const grouped: Record<string, Member[]> = {
        [MemberStatus.ACTIVE]: activeMembers,
        [MemberStatus.DORMANT]: dormantMembers,
        [MemberStatus.WITHDRAWN]: withdrawnMembers,
      };

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 스터디 참가자 목록')
        .setTimestamp();

      // Add summary
      const activeCount = activeMembers.length;
      const dormantCount = dormantMembers.length;
      const withdrawnCount = withdrawnMembers.length;
      const totalCount = allMembers.length;

      embed.setDescription(
        `총 **${totalCount}명** (활동 ${activeCount} / 휴면 ${dormantCount} / 탈퇴 ${withdrawnCount})`
      );

      // Helper to add member group to embed
      const addMemberGroup = (members: Member[], status: string) => {
        if (members.length === 0) return;

        const emoji = STATUS_EMOJI[status] || '📌';
        const title = STATUS_TITLE[status] || status;
        const memberList = formatMemberList(members);

        if (memberList.length <= 1024) {
          embed.addFields({
            name: `${emoji} ${title} (${members.length}명)`,
            value: memberList,
            inline: false,
          });
        } else {
          const truncated = members.slice(0, 10);
          embed.addFields({
            name: `${emoji} ${title} (${members.length}명)`,
            value: formatMemberList(truncated) + `\n... 외 ${members.length - 10}명`,
            inline: false,
          });
        }
      };

      // Add fields based on filter
      if (statusFilter === 'all') {
        // Show all groups
        addMemberGroup(activeMembers, MemberStatus.ACTIVE);
        addMemberGroup(dormantMembers, MemberStatus.DORMANT);
        addMemberGroup(withdrawnMembers, MemberStatus.WITHDRAWN);
      } else {
        // Show only filtered status
        const members = grouped[statusFilter] || [];
        const emoji = STATUS_EMOJI[statusFilter] || '📌';
        const title = STATUS_TITLE[statusFilter] || statusFilter;

        if (members.length === 0) {
          embed.addFields({
            name: `${emoji} ${title}`,
            value: '해당 상태의 참가자가 없습니다.',
            inline: false,
          });
        } else {
          addMemberGroup(members, statusFilter);
        }
      }

      embed.setFooter({
        text: '💡 /내정보 명령어로 본인의 상세 정보를 확인하세요',
      });

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error('Error in /참가자목록 command:', error);
      await interaction.reply({
        content: '❌ 참가자 목록 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: false,
};
