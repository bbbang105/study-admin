/**
 * /큐레이션소스 명령어 - 큐레이션 소스 관리 (관리자 전용)
 * Requirements: 15.5
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler } from '../../bot';
import { getCurationService } from '../../services/curation.service';
import { CurationCategory } from '@blog-study/shared/db';

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export const 큐레이션소스Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('큐레이션소스')
    .setDescription('[관리자] 큐레이션 소스를 관리합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('추가')
        .setDescription('새 큐레이션 소스를 추가합니다.')
        .addStringOption((option) =>
          option
            .setName('url')
            .setDescription('소스 URL')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('이름')
            .setDescription('소스 이름')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('카테고리')
            .setDescription('소스 카테고리')
            .setRequired(true)
            .addChoices(
              { name: '컨퍼런스', value: CurationCategory.CONFERENCE },
              { name: '아티클', value: CurationCategory.ARTICLE }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('삭제')
        .setDescription('큐레이션 소스를 삭제합니다.')
        .addStringOption((option) =>
          option
            .setName('url')
            .setDescription('삭제할 소스 URL')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('목록')
        .setDescription('등록된 큐레이션 소스 목록을 조회합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('활성화')
        .setDescription('큐레이션 소스를 활성화합니다.')
        .addStringOption((option) =>
          option
            .setName('url')
            .setDescription('활성화할 소스 URL')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('비활성화')
        .setDescription('큐레이션 소스를 비활성화합니다.')
        .addStringOption((option) =>
          option
            .setName('url')
            .setDescription('비활성화할 소스 URL')
            .setRequired(true)
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case '추가':
          await handleAdd(interaction);
          break;
        case '삭제':
          await handleRemove(interaction);
          break;
        case '목록':
          await handleList(interaction);
          break;
        case '활성화':
          await handleActivate(interaction);
          break;
        case '비활성화':
          await handleDeactivate(interaction);
          break;
        default:
          await interaction.reply({
            content: '❌ 알 수 없는 명령어입니다.',
            ephemeral: true,
          });
      }
    } catch (error) {
      console.error('Error in /큐레이션소스 command:', error);
      await interaction.reply({
        content: '❌ 명령어 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: true,
};

/**
 * Handle /큐레이션소스 추가 [URL] [이름] [카테고리]
 * Requirements: 15.5
 */
async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const url = interaction.options.getString('url', true);
  const name = interaction.options.getString('이름', true);
  const category = interaction.options.getString('카테고리', true);

  // Validate URL
  if (!isValidUrl(url)) {
    await interaction.reply({
      content: '❌ 올바른 URL 형식이 아닙니다.',
      ephemeral: true,
    });
    return;
  }

  const curationService = getCurationService();

  // Check if already exists
  const existing = await curationService.getSourceByUrl(url);
  if (existing) {
    await interaction.reply({
      content: `❌ 이미 등록된 소스입니다: **${existing.name}**`,
      ephemeral: true,
    });
    return;
  }

  // Add source
  const source = await curationService.addSource(url, name, category);

  const categoryLabel = category === CurationCategory.CONFERENCE ? '컨퍼런스' : '아티클';

  await interaction.reply({
    content: [
      `✅ **큐레이션 소스 추가 완료**`,
      ``,
      `📌 **이름:** ${source.name}`,
      `🔗 **URL:** ${source.url}`,
      `📂 **카테고리:** ${categoryLabel}`,
      ``,
      `💡 매일 09:00에 자동으로 크롤링됩니다.`,
    ].join('\n'),
  });
}

/**
 * Handle /큐레이션소스 삭제 [URL]
 * Requirements: 15.5
 */
async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const url = interaction.options.getString('url', true);

  const curationService = getCurationService();

  // Find source
  const source = await curationService.getSourceByUrl(url);
  if (!source) {
    await interaction.reply({
      content: '❌ 해당 URL의 소스를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  // Remove source
  await curationService.removeSource(source.id);

  await interaction.reply({
    content: [
      `✅ **큐레이션 소스 삭제 완료**`,
      ``,
      `📌 **이름:** ${source.name}`,
      `🔗 **URL:** ${source.url}`,
      ``,
      `⚠️ 해당 소스에서 수집된 아이템도 함께 삭제되었습니다.`,
    ].join('\n'),
  });
}

/**
 * Handle /큐레이션소스 목록
 */
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const curationService = getCurationService();
  const sources = await curationService.getAllSources();

  if (sources.length === 0) {
    await interaction.reply({
      content: '📋 등록된 큐레이션 소스가 없습니다.\n\n`/큐레이션소스 추가` 명령어로 소스를 추가해주세요.',
    });
    return;
  }

  const activeSources = sources.filter(s => s.isActive);
  const inactiveSources = sources.filter(s => !s.isActive);

  const lines: string[] = [
    `📋 **큐레이션 소스 목록** (총 ${sources.length}개)`,
    ``,
  ];

  if (activeSources.length > 0) {
    lines.push(`**✅ 활성 소스 (${activeSources.length}개)**`);
    for (const source of activeSources) {
      const categoryEmoji = source.category === CurationCategory.CONFERENCE ? '🎤' : '📰';
      lines.push(`${categoryEmoji} **${source.name}**`);
      lines.push(`   ${source.url}`);
    }
    lines.push('');
  }

  if (inactiveSources.length > 0) {
    lines.push(`**⏸️ 비활성 소스 (${inactiveSources.length}개)**`);
    for (const source of inactiveSources) {
      const categoryEmoji = source.category === CurationCategory.CONFERENCE ? '🎤' : '📰';
      lines.push(`${categoryEmoji} ~~${source.name}~~`);
      lines.push(`   ${source.url}`);
    }
  }

  await interaction.reply({
    content: lines.join('\n'),
  });
}

/**
 * Handle /큐레이션소스 활성화 [URL]
 */
async function handleActivate(interaction: ChatInputCommandInteraction): Promise<void> {
  const url = interaction.options.getString('url', true);

  const curationService = getCurationService();

  // Find source
  const source = await curationService.getSourceByUrl(url);
  if (!source) {
    await interaction.reply({
      content: '❌ 해당 URL의 소스를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  if (source.isActive) {
    await interaction.reply({
      content: `ℹ️ **${source.name}**은(는) 이미 활성화되어 있습니다.`,
      ephemeral: true,
    });
    return;
  }

  // Activate source
  await curationService.setSourceActive(source.id, true);

  await interaction.reply({
    content: [
      `✅ **큐레이션 소스 활성화 완료**`,
      ``,
      `📌 **이름:** ${source.name}`,
      `🔗 **URL:** ${source.url}`,
      ``,
      `💡 다음 크롤링 시간(09:00)부터 수집이 재개됩니다.`,
    ].join('\n'),
  });
}

/**
 * Handle /큐레이션소스 비활성화 [URL]
 */
async function handleDeactivate(interaction: ChatInputCommandInteraction): Promise<void> {
  const url = interaction.options.getString('url', true);

  const curationService = getCurationService();

  // Find source
  const source = await curationService.getSourceByUrl(url);
  if (!source) {
    await interaction.reply({
      content: '❌ 해당 URL의 소스를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  if (!source.isActive) {
    await interaction.reply({
      content: `ℹ️ **${source.name}**은(는) 이미 비활성화되어 있습니다.`,
      ephemeral: true,
    });
    return;
  }

  // Deactivate source
  await curationService.setSourceActive(source.id, false);

  await interaction.reply({
    content: [
      `✅ **큐레이션 소스 비활성화 완료**`,
      ``,
      `📌 **이름:** ${source.name}`,
      `🔗 **URL:** ${source.url}`,
      ``,
      `⏸️ 해당 소스의 크롤링이 중지되었습니다.`,
    ].join('\n'),
  });
}
