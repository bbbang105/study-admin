/**
 * /관심분야 명령어 - 스터디원 관심 분야 조회
 * 스터디원들의 블로그 글에서 추출된 Top 10 키워드를 표시합니다.
 * Requirements: 14.3
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../bot';
import { getKeywordService, type KeywordStat } from '../services/keyword.service';
import { getRankEmoji } from './constants';

/**
 * Format keyword entry for display
 */
function formatKeywordEntry(entry: KeywordStat, rank: number): string {
  const rankEmoji = getRankEmoji(rank);
  return `${rankEmoji} **${entry.keyword}** - ${entry.frequency}회`;
}

/**
 * Format top keywords for display
 * Requirements: 14.3 - Display top 10 keywords with frequency counts
 */
export function formatTopKeywords(keywords: KeywordStat[]): string {
  if (keywords.length === 0) {
    return '아직 분석된 키워드가 없습니다.';
  }

  return keywords
    .map((entry, index) => formatKeywordEntry(entry, index + 1))
    .join('\n');
}

export const 관심분야Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('관심분야')
    .setDescription('스터디원들의 관심 분야 Top 10 키워드를 조회합니다.')
    .addIntegerOption((option) =>
      option
        .setName('개수')
        .setDescription('표시할 키워드 수 (기본: 10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const limit = interaction.options.getInteger('개수') || 10;

      const keywordService = getKeywordService();

      // Get top keywords
      const topKeywords = await keywordService.getTopKeywords(limit);

      if (topKeywords.length === 0) {
        await interaction.reply({
          content: '📊 아직 분석된 키워드가 없습니다. 스터디원들의 글이 수집되면 관심 분야가 분석됩니다.',
        });
        return;
      }

      // Calculate total frequency
      const totalFrequency = topKeywords.reduce((sum, k) => sum + k.frequency, 0);

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6) // Purple color for interests
        .setTitle('🔍 스터디원 관심 분야')
        .setDescription(
          [
            `총 **${topKeywords.length}개** 키워드 분석`,
            `총 언급 횟수: **${totalFrequency}회**`,
            '',
            '📊 **블로그 글 기반 키워드 분석**',
          ].join('\n')
        )
        .setTimestamp();

      // Format keyword list
      const keywordList = formatTopKeywords(topKeywords);

      embed.addFields({
        name: `Top ${topKeywords.length} 키워드`,
        value: keywordList,
        inline: false,
      });

      // Add footer with info
      embed.setFooter({
        text: '💡 스터디원들의 블로그 글 제목과 설명에서 추출된 키워드입니다.',
      });

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error('Error in /관심분야 command:', error);
      await interaction.reply({
        content: '❌ 관심 분야 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: false,
};
