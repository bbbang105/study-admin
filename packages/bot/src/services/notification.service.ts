/**
 * Notification Service
 * 새 글 알림 및 회차 리포트 서비스
 * Requirements: 7.1, 7.2, 7.3, 7.4, 10.1, 10.2, 10.3, 10.4
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  type MessageCreateOptions,
  TextChannel,
} from 'discord.js';
import type { AttendanceStatusType, Member, Post, Round } from '@blog-study/shared/db';
import { AttendanceStatus, getDb, members, MemberStatus } from '@blog-study/shared/db';
import { eq } from 'drizzle-orm';
import { ConfigKeys, getConfigValue } from './round.service';
import logger from '../lib/logger';
import { logNotification } from '../lib/notification-logger';

const KUSTING_WEB_URL = 'https://kusting-web.vercel.app';

/**
 * Error codes for notification operations
 */
export const NotificationErrorCodes = {
  CHANNEL_NOT_FOUND: 'E5001',
  CHANNEL_NOT_CONFIGURED: 'E5002',
  SEND_FAILED: 'E5003',
} as const;

/**
 * Custom error class for notification operations
 */
export class NotificationError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    message?: string
  ) {
    super(message || userMessage);
    this.name = 'NotificationError';
  }
}

/**
 * Input for creating a new post notification
 * Requirements: 7.2 - Notification message format
 */
export interface PostNotificationInput {
  post: Post;
  member: Member;
  roundNumber: number | null;
}

/**
 * Build notification embed message for a new post
 * Requirements: 7.2 - Include post title, author Discord mention, post URL, and round number
 */
export function buildPostNotificationEmbed(input: PostNotificationInput): EmbedBuilder {
  const { post, member, roundNumber } = input;
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2) // Discord blurple
    .setTitle(`📝 ${post.title}`)
    .setURL(post.url)
    .setAuthor({
      name: member.discordUsername,
      iconURL: member.profileImageUrl || undefined,
    })
    .setTimestamp(post.publishedAt);

  // Add round number if available
  if (roundNumber !== null) {
    embed.addFields({
      name: '📅 회차',
      value: `${roundNumber}회차`,
      inline: true,
    });
  }

  // Add description if available (strip HTML tags, truncate)
  if (post.description) {
    const plainText = post.description.replace(/<[^>]*>/g, '').trim();
    if (plainText) {
      const truncatedDesc = plainText.length > 200
        ? plainText.substring(0, 197) + '...'
        : plainText;
      embed.setDescription(truncatedDesc);
    }
  }

  // Add thumbnail (OG image) if available
  if (post.thumbnailUrl) {
    embed.setImage(post.thumbnailUrl);
  }

  embed.setFooter({
    text: `${member.name} • ${member.part}`,
  });

  return embed;
}

/**
 * Build reaction buttons for post notification
 * Requirements: 7.4 - Add reaction buttons for engagement
 */
export function buildPostNotificationButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('post_like')
      .setLabel('👍')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('post_comment')
      .setLabel('💬')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('post_bookmark')
      .setLabel('🔖')
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Build the complete notification message
 * Requirements: 7.2 - Include all required fields
 */
export function buildPostNotificationMessage(input: PostNotificationInput): MessageCreateOptions {
  const { post, member } = input;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('📖 블로그 원문 보기')
      .setStyle(ButtonStyle.Link)
      .setURL(post.url),
    new ButtonBuilder()
      .setLabel('🔗 큐스팅 웹에서 보기')
      .setStyle(ButtonStyle.Link)
      .setURL(`${KUSTING_WEB_URL}/posts/${post.id}`),
  );

  return {
    content: `<@${member.discordId}>님이 새 글을 발행했습니다! 🎉`,
    embeds: [buildPostNotificationEmbed(input)],
    components: [row],
  };
}


/**
 * Attendance summary for round report
 */
export interface AttendanceSummary {
  memberId: string;
  discordId: string;
  discordUsername: string;
  name: string;
  status: AttendanceStatusType;
  postCount: number;
}

/**
 * Round report data
 * Requirements: 10.2 - Round report content
 */
export interface RoundReportData {
  round: Round;
  submitted: AttendanceSummary[];
  mvps: AttendanceSummary[];
  totalMembers: number;
  submissionRate: number;
  lateRate: number;
  absentRate: number;
}

/**
 * Build round report embed
 * Requirements: 10.2 - Include round number, submission list, late list, absent list
 * Requirements: 10.3 - Highlight MVP
 */
export function buildRoundReportEmbed(data: RoundReportData): EmbedBuilder {
  const { round, submitted, mvps, submissionRate, lateRate, absentRate } = data;
  
  const embed = new EmbedBuilder()
    .setColor(0x57F287) // Green
    .setTitle(`📊 ${round.roundNumber}회차 리포트`)
    .setDescription(`${round.startDate} ~ ${round.endDate}`)
    .setTimestamp();

  // Statistics
  embed.addFields({
    name: '📈 통계',
    value: [
      `✅ 제출률: ${(submissionRate * 100).toFixed(1)}%`,
      `⏰ 지각률: ${(lateRate * 100).toFixed(1)}%`,
      `❌ 결석률: ${(absentRate * 100).toFixed(1)}%`,
    ].join('\n'),
    inline: false,
  });

  // MVP (동점 시 복수)
  if (mvps.length > 0) {
    const mvpText = mvps.map((m) => `<@${m.discordId}> (${m.postCount}개 작성)`).join('\n');
    embed.addFields({
      name: `🏆 MVP${mvps.length > 1 ? ` (${mvps.length}명)` : ''}`,
      value: mvpText,
      inline: false,
    });
  }

  // Submitted list
  if (submitted.length > 0) {
    const submittedList = submitted
      .map((s) => `• <@${s.discordId}> (${s.name})`)
      .join('\n');
    embed.addFields({
      name: `✅ 제출 (${submitted.length}명)`,
      value: submittedList.length > 1024 ? submittedList.substring(0, 1021) + '...' : submittedList,
      inline: true,
    });
  }

  return embed;
}

/**
 * Build round report message
 * Requirements: 10.1 - Generate and send round report
 */
export function buildRoundReportMessage(data: RoundReportData): MessageCreateOptions {
  return {
    content: `📢 **${data.round.roundNumber}회차가 종료되었습니다!**`,
    embeds: [buildRoundReportEmbed(data)],
  };
}

/**
 * Build round start announcement embed
 * Requirements: 10.4 - Send round start announcement with deadline info
 */
export function buildRoundStartEmbed(round: Round, activeCount: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865F2) // Discord blurple
    .setTitle(`🚀 ${round.roundNumber}회차 시작!`)
    .setDescription([
      `이번 회차에 **${activeCount}명**이 함께합니다.`,
      '이번 회차도 화이팅! 짧은 글이라도 괜찮아요 😌',
    ].join('\n'))
    .addFields(
      {
        name: '📅 기간',
        value: `${round.startDate} ~ ${round.endDate}`,
        inline: true,
      },
      {
        name: '⏰ 마감일',
        value: round.endDate,
        inline: true,
      },
      {
        name: '🕐 지각 마감',
        value: `${round.graceEndDate} (벌금 5,000원)`,
        inline: true,
      }
    )
    .setFooter({
      text: '마감일까지 블로그 글을 작성해주세요!',
    })
    .setTimestamp();
}

/**
 * Build round start announcement message with active member mentions
 * Requirements: 10.4 - Send round start announcement
 */
export function buildRoundStartMessage(round: Round, activeMembers: { discordId: string }[]): MessageCreateOptions {
  const mentions = activeMembers.map((m) => `<@${m.discordId}>`).join(' ');

  return {
    content: `📢 **${round.roundNumber}회차가 시작되었습니다!**\n\n🏃🏻 **함께 달릴 스터디원**\n${mentions}`,
    embeds: [buildRoundStartEmbed(round, activeMembers.length)],
  };
}

/**
 * Calculate round report data from attendance records
 */
export function calculateRoundReportData(
  round: Round,
  attendanceSummaries: AttendanceSummary[]
): RoundReportData {
  const submitted = attendanceSummaries.filter(
    (a) => a.status === AttendanceStatus.SUBMITTED
  );
  const late = attendanceSummaries.filter(
    (a) => a.status === AttendanceStatus.LATE
  );
  const absent = attendanceSummaries.filter(
    (a) => a.status === AttendanceStatus.ABSENT
  );

  const totalMembers = attendanceSummaries.length;
  const submissionRate = totalMembers > 0 ? submitted.length / totalMembers : 0;
  const lateRate = totalMembers > 0 ? late.length / totalMembers : 0;
  const absentRate = totalMembers > 0 ? absent.length / totalMembers : 0;

  // Find MVPs (동점 시 복수)
  const allWithPosts = [...submitted, ...late].filter((a) => a.postCount > 0);
  let mvps: AttendanceSummary[] = [];
  if (allWithPosts.length > 0) {
    const maxPosts = Math.max(...allWithPosts.map((a) => a.postCount));
    mvps = allWithPosts.filter((a) => a.postCount === maxPosts);
  }

  return {
    round,
    submitted,
    mvps,
    totalMembers,
    submissionRate,
    lateRate,
    absentRate,
  };
}

/**
 * Notification service class for sending Discord notifications
 */
export class NotificationService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Get the announcement channel (#새-글-알림)
   * Requirements: 7.3 - Check if announcement channel is configured
   */
  async getAnnouncementChannel(): Promise<TextChannel | null> {
    return this.fetchTextChannel(ConfigKeys.ANNOUNCEMENT_CHANNEL_ID, 'Announcement');
  }

  /**
   * Get the notice channel (#공지사항)
   * 회차 시작/종료 등 공지성 메시지 전용
   */
  async getNoticeChannel(): Promise<TextChannel | null> {
    // notice_channel_id 미설정 시 announcement_channel_id로 폴백
    const channel = await this.fetchTextChannel(ConfigKeys.NOTICE_CHANNEL_ID, 'Notice');
    if (channel) return channel;
    return this.getAnnouncementChannel();
  }

  private async fetchTextChannel(configKey: string, label: string): Promise<TextChannel | null> {
    const channelId = await getConfigValue(configKey);

    if (!channelId) {
      logger.warn({ channelType: label }, '📢 [알림] 채널 미설정');
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel instanceof TextChannel) {
        return channel;
      }
      logger.warn({ channelType: label }, '📢 [알림] 채널이 텍스트 채널이 아님');
      return null;
    } catch (error) {
      logger.error({ channelType: label, error }, '📢 [알림] 채널 조회 실패');
      return null;
    }
  }

  /**
   * Send a new post notification
   * Requirements: 7.1 - Send notification to designated channel
   * Requirements: 7.3 - Log error if channel not configured
   */
  async sendPostNotification(input: PostNotificationInput): Promise<boolean> {
    const channel = await this.getAnnouncementChannel();
    
    if (!channel) {
      logger.error('📢 [알림] 디스코드 알림 발송 불가: 채널 미설정');
      return false;
    }

    try {
      const message = buildPostNotificationMessage(input);
      const sent = await channel.send(message);
      await logNotification({
        source: 'bot', type: 'new_post',
        channelId: channel.id, channelName: channel.name ?? undefined,
        messageId: sent.id,
        summary: `새 글: ${input.post.title}`.slice(0, 200),
        metadata: { memberDiscordId: input.member.discordId },
        status: 'sent',
      });
      logger.info({ postTitle: input.post.title }, '📢 [알림] 디스코드 알림 발송 완료');
      return true;
    } catch (error) {
      await logNotification({
        source: 'bot', type: 'new_post',
        channelId: channel?.id, channelName: channel?.name ?? undefined,
        summary: `새 글: ${input.post.title}`.slice(0, 200),
        status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
      });
      logger.error({ error }, '📢 [알림] 디스코드 알림 발송 실패');
      return false;
    }
  }

  /**
   * Send a round report to notice channel (#공지사항)
   * Requirements: 10.1 - Send round report to designated channel
   */
  async sendRoundReport(data: RoundReportData): Promise<boolean> {
    const channel = await this.getNoticeChannel();
    
    if (!channel) {
      logger.error('📢 [알림] 회차 리포트 발송 불가: 채널 미설정');
      return false;
    }

    try {
      const message = buildRoundReportMessage(data);
      const sent = await channel.send(message);
      await logNotification({
        source: 'bot', type: 'round_report',
        channelId: channel.id, channelName: channel.name ?? undefined,
        messageId: sent.id,
        summary: `${data.round.roundNumber}회차 리포트`,
        status: 'sent',
      });
      logger.info({ roundNumber: data.round.roundNumber }, '📢 [알림] 회차 리포트 발송 완료');
      return true;
    } catch (error) {
      await logNotification({
        source: 'bot', type: 'round_report',
        channelId: channel?.id, channelName: channel?.name ?? undefined,
        summary: `${data.round.roundNumber}회차 리포트`,
        status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
      });
      logger.error({ error }, '📢 [알림] 회차 리포트 발송 실패');
      return false;
    }
  }

  /**
   * Send a round start announcement with active member mentions
   * Requirements: 10.4 - Send round start announcement
   */
  async sendRoundStartAnnouncement(round: Round): Promise<boolean> {
    const channel = await this.getNoticeChannel();

    if (!channel) {
      logger.error('📢 [알림] 회차 시작 공지 발송 불가: 채널 미설정');
      return false;
    }

    try {
      // active 상태 멤버만 조회
      const db = getDb();
      const activeMembers = await db
        .select({ discordId: members.discordId })
        .from(members)
        .where(eq(members.status, MemberStatus.ACTIVE));

      const message = buildRoundStartMessage(round, activeMembers);
      const sent = await channel.send(message);
      await logNotification({
        source: 'bot', type: 'round_start',
        channelId: channel.id, channelName: channel.name ?? undefined,
        messageId: sent.id,
        summary: `${round.roundNumber}회차 시작 공지`,
        metadata: { activeMemberCount: activeMembers.length },
        status: 'sent',
      });
      logger.info({
        roundNumber: round.roundNumber,
        activeMemberCount: activeMembers.length
      }, '📢 [알림] 회차 시작 공지 발송 완료');
      return true;
    } catch (error) {
      await logNotification({
        source: 'bot', type: 'round_start',
        channelId: channel?.id, channelName: channel?.name ?? undefined,
        summary: `${round.roundNumber}회차 시작 공지`,
        status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
      });
      logger.error({ error }, '📢 [알림] 회차 시작 공지 발송 실패');
      return false;
    }
  }
}

// Singleton instance
let notificationServiceInstance: NotificationService | null = null;

/**
 * Initialize the NotificationService with a Discord client
 */
export function initNotificationService(client: Client): NotificationService {
  notificationServiceInstance = new NotificationService(client);
  return notificationServiceInstance;
}

/**
 * Get the NotificationService singleton instance
 * @throws Error if not initialized
 */
export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    throw new Error('NotificationService not initialized. Call initNotificationService first.');
  }
  return notificationServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetNotificationService(): void {
  notificationServiceInstance = null;
}
