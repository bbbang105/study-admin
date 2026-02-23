/**
 * /설정 명령어 - 스터디 설정 관리 (관리자 전용)
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import {
  SlashCommandBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import type { CommandHandler } from '../../bot';
import {
  ConfigKeys,
  setConfigValue,
  getConfigValue,
  createRounds,
  deleteAllRounds,
  getAllRounds,
} from '../../services/round.service';

/**
 * Parse date string in YYYY-MM-DD format
 */
function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(
    parseInt(year!, 10),
    parseInt(month!, 10) - 1,
    parseInt(day!, 10)
  ));

  // Validate the date is valid
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

export const 설정Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('설정')
    .setDescription('[관리자] 스터디 설정을 관리합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작일')
        .setDescription('스터디 시작일을 설정합니다.')
        .addStringOption((option) =>
          option
            .setName('날짜')
            .setDescription('시작일 (YYYY-MM-DD 형식, 월요일이어야 함)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('총회차')
        .setDescription('총 회차 수를 설정합니다.')
        .addIntegerOption((option) =>
          option
            .setName('숫자')
            .setDescription('총 회차 수 (1-52)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(52)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('알림채널')
        .setDescription('새 글 알림 채널을 설정합니다.')
        .addChannelOption((option) =>
          option
            .setName('채널')
            .setDescription('알림을 보낼 채널')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('큐레이션채널')
        .setDescription('큐레이션 컨텐츠 공유 채널을 설정합니다.')
        .addChannelOption((option) =>
          option
            .setName('채널')
            .setDescription('큐레이션을 공유할 채널')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('조회')
        .setDescription('현재 스터디 설정을 조회합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('회차초기화')
        .setDescription('회차를 초기화하고 새로 생성합니다. (주의: 기존 회차 삭제)')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case '시작일':
          await handleStartDate(interaction);
          break;
        case '총회차':
          await handleTotalRounds(interaction);
          break;
        case '알림채널':
          await handleAnnouncementChannel(interaction);
          break;
        case '큐레이션채널':
          await handleCurationChannel(interaction);
          break;
        case '조회':
          await handleView(interaction);
          break;
        case '회차초기화':
          await handleRoundInit(interaction);
          break;
        default:
          await interaction.reply({
            content: '❌ 알 수 없는 설정 명령어입니다.',
            ephemeral: true,
          });
      }
    } catch (error) {
      console.error('Error in /설정 command:', error);
      await interaction.reply({
        content: '❌ 설정 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });
    }
  },

  adminOnly: true,
};

/**
 * Handle /설정 시작일 [날짜]
 * Requirements: 15.1
 */
async function handleStartDate(interaction: ChatInputCommandInteraction): Promise<void> {
  const dateStr = interaction.options.getString('날짜', true);
  const date = parseDate(dateStr);

  if (!date) {
    await interaction.reply({
      content: '❌ 날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요. (예: 2024-01-01)',
      ephemeral: true,
    });
    return;
  }

  // Check if the date is a Monday (0 = Sunday, 1 = Monday, ...)
  if (date.getUTCDay() !== 1) {
    await interaction.reply({
      content: '❌ 시작일은 월요일이어야 합니다. 다른 날짜를 선택해주세요.',
      ephemeral: true,
    });
    return;
  }

  await setConfigValue(ConfigKeys.STUDY_START_DATE, formatDate(date));

  await interaction.reply({
    content: [
      `✅ **스터디 시작일 설정 완료**`,
      ``,
      `📅 **시작일:** ${formatDate(date)}`,
      ``,
      `💡 회차를 새로 생성하려면 \`/설정 회차초기화\` 명령어를 사용하세요.`,
    ].join('\n'),
  });
}

/**
 * Handle /설정 총회차 [숫자]
 * Requirements: 15.2
 */
async function handleTotalRounds(interaction: ChatInputCommandInteraction): Promise<void> {
  const totalRounds = interaction.options.getInteger('숫자', true);

  await setConfigValue(ConfigKeys.TOTAL_ROUNDS, totalRounds.toString());

  await interaction.reply({
    content: [
      `✅ **총 회차 수 설정 완료**`,
      ``,
      `🔢 **총 회차:** ${totalRounds}회`,
      `📆 **총 기간:** ${totalRounds * 2}주`,
      ``,
      `💡 회차를 새로 생성하려면 \`/설정 회차초기화\` 명령어를 사용하세요.`,
    ].join('\n'),
  });
}

/**
 * Handle /설정 알림채널 [채널]
 * Requirements: 15.3
 */
async function handleAnnouncementChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel('채널', true) as TextChannel;

  await setConfigValue(ConfigKeys.ANNOUNCEMENT_CHANNEL, channel.id);

  await interaction.reply({
    content: [
      `✅ **알림 채널 설정 완료**`,
      ``,
      `📢 **알림 채널:** <#${channel.id}>`,
      ``,
      `💡 새 글이 등록되면 해당 채널에 알림이 발송됩니다.`,
    ].join('\n'),
  });
}

/**
 * Handle /설정 큐레이션채널 [채널]
 * Requirements: 15.4
 */
async function handleCurationChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel('채널', true) as TextChannel;

  await setConfigValue(ConfigKeys.CURATION_CHANNEL, channel.id);

  await interaction.reply({
    content: [
      `✅ **큐레이션 채널 설정 완료**`,
      ``,
      `📚 **큐레이션 채널:** <#${channel.id}>`,
      ``,
      `💡 큐레이션된 컨텐츠가 해당 채널에 공유됩니다.`,
    ].join('\n'),
  });
}

/**
 * Handle /설정 조회
 */
async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
  const startDate = await getConfigValue(ConfigKeys.STUDY_START_DATE);
  const totalRounds = await getConfigValue(ConfigKeys.TOTAL_ROUNDS);
  const announcementChannel = await getConfigValue(ConfigKeys.ANNOUNCEMENT_CHANNEL);
  const curationChannel = await getConfigValue(ConfigKeys.CURATION_CHANNEL);
  const rounds = await getAllRounds();

  const currentRound = rounds.find((r) => r.isCurrent);

  await interaction.reply({
    content: [
      `📋 **현재 스터디 설정**`,
      ``,
      `📅 **시작일:** ${startDate || '미설정'}`,
      `🔢 **총 회차:** ${totalRounds ? `${totalRounds}회` : '미설정'}`,
      `📢 **알림 채널:** ${announcementChannel ? `<#${announcementChannel}>` : '미설정'}`,
      `📚 **큐레이션 채널:** ${curationChannel ? `<#${curationChannel}>` : '미설정'}`,
      ``,
      `📊 **회차 정보:**`,
      `- 생성된 회차: ${rounds.length}개`,
      `- 현재 회차: ${currentRound ? `${currentRound.roundNumber}회차` : '없음'}`,
    ].join('\n'),
  });
}

/**
 * Handle /설정 회차초기화
 */
async function handleRoundInit(interaction: ChatInputCommandInteraction): Promise<void> {
  const startDateStr = await getConfigValue(ConfigKeys.STUDY_START_DATE);
  const totalRoundsStr = await getConfigValue(ConfigKeys.TOTAL_ROUNDS);

  if (!startDateStr) {
    await interaction.reply({
      content: '❌ 시작일이 설정되지 않았습니다. `/설정 시작일 [날짜]` 명령어로 먼저 설정해주세요.',
      ephemeral: true,
    });
    return;
  }

  if (!totalRoundsStr) {
    await interaction.reply({
      content: '❌ 총 회차가 설정되지 않았습니다. `/설정 총회차 [숫자]` 명령어로 먼저 설정해주세요.',
      ephemeral: true,
    });
    return;
  }

  const startDate = parseDate(startDateStr);
  const totalRounds = parseInt(totalRoundsStr, 10);

  if (!startDate) {
    await interaction.reply({
      content: '❌ 저장된 시작일 형식이 올바르지 않습니다. `/설정 시작일 [날짜]` 명령어로 다시 설정해주세요.',
      ephemeral: true,
    });
    return;
  }

  // Delete existing rounds and create new ones
  await deleteAllRounds();
  const createdRounds = await createRounds(startDate, totalRounds);

  const firstRound = createdRounds[0];
  const lastRound = createdRounds[createdRounds.length - 1];

  await interaction.reply({
    content: [
      `✅ **회차 초기화 완료**`,
      ``,
      `📅 **시작일:** ${startDateStr}`,
      `🔢 **총 회차:** ${totalRounds}회`,
      `📊 **생성된 회차:** ${createdRounds.length}개`,
      ``,
      `📆 **기간:**`,
      `- 1회차: ${firstRound?.startDate} ~ ${firstRound?.endDate}`,
      `- ${totalRounds}회차: ${lastRound?.startDate} ~ ${lastRound?.endDate}`,
      ``,
      `💡 현재 1회차가 진행 중으로 설정되었습니다.`,
    ].join('\n'),
  });
}
