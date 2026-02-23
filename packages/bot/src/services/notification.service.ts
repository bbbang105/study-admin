/**
 * Notification Service
 * 새 글 알림 및 회차 리포트 서비스
 * Requirements: 7.1, 7.2, 7.3, 7.4, 10.1, 10.2, 10.3, 10.4
 */

import {
  Client,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageCreateOptions,
} from 'discord.js';
import type { Member, Post, Round, AttendanceStatusType } from '@blog-study/shared/db';
import { AttendanceStatus } from '@blog-study/shared/db';
import { getConfigValue, ConfigKeys } from './round.service';

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

  // Add description if available (truncate if too long)
  if (post.description) {
    const truncatedDesc = post.description.length > 200
      ? post.description.substring(0, 197) + '...'
      : post.description;
    embed.setDescription(truncatedDesc);
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
  const { member } = input;
  
  return {
    content: `<@${member.discordId}>님이 새 글을 발행했습니다! 🎉`,
    embeds: [buildPostNotificationEmbed(input)],
    components: [buildPostNotificationButtons()],
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
  late: AttendanceSummary[];
  absent: AttendanceSummary[];
  mvp: AttendanceSummary | null;
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
  const { round, submitted, late, absent, mvp, submissionRate, lateRate, absentRate } = data;
  
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

  // MVP
  if (mvp) {
    embed.addFields({
      name: '🏆 MVP',
      value: `<@${mvp.discordId}> (${mvp.postCount}개 작성)`,
      inline: false,
    });
  }

  // Submitted list
  if (submitted.length > 0) {
    const submittedList = submitted
      .map((s) => `• <@${s.discordId}>`)
      .join('\n');
    embed.addFields({
      name: `✅ 제출 (${submitted.length}명)`,
      value: submittedList.length > 1024 ? submittedList.substring(0, 1021) + '...' : submittedList,
      inline: true,
    });
  }

  // Late list
  if (late.length > 0) {
    const lateList = late
      .map((l) => `• <@${l.discordId}>`)
      .join('\n');
    embed.addFields({
      name: `⏰ 지각 (${late.length}명)`,
      value: lateList.length > 1024 ? lateList.substring(0, 1021) + '...' : lateList,
      inline: true,
    });
  }

  // Absent list
  if (absent.length > 0) {
    const absentList = absent
      .map((a) => `• <@${a.discordId}>`)
      .join('\n');
    embed.addFields({
      name: `❌ 결석 (${absent.length}명)`,
      value: absentList.length > 1024 ? absentList.substring(0, 1021) + '...' : absentList,
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
export function buildRoundStartEmbed(round: Round): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865F2) // Discord blurple
    .setTitle(`🚀 ${round.roundNumber}회차 시작!`)
    .setDescription('새로운 회차가 시작되었습니다. 열심히 글을 작성해주세요!')
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
        value: `${round.graceEndDate} (벌금 3,000원)`,
        inline: true,
      }
    )
    .setFooter({
      text: '마감일까지 블로그 글을 작성해주세요!',
    })
    .setTimestamp();
}

/**
 * Build round start announcement message
 * Requirements: 10.4 - Send round start announcement
 */
export function buildRoundStartMessage(round: Round): MessageCreateOptions {
  return {
    content: '@everyone 새로운 회차가 시작되었습니다! 📝',
    embeds: [buildRoundStartEmbed(round)],
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

  // Find MVP (member with most posts in this round)
  const allWithPosts = [...submitted, ...late].filter((a) => a.postCount > 0);
  const mvp = allWithPosts.length > 0
    ? allWithPosts.reduce((max, curr) => 
        curr.postCount > max.postCount ? curr : max
      )
    : null;

  return {
    round,
    submitted,
    late,
    absent,
    mvp,
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
   * Get the announcement channel
   * Requirements: 7.3 - Check if announcement channel is configured
   */
  async getAnnouncementChannel(): Promise<TextChannel | null> {
    const channelId = await getConfigValue(ConfigKeys.ANNOUNCEMENT_CHANNEL);
    
    if (!channelId) {
      console.warn('[NotificationService] Announcement channel not configured');
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel instanceof TextChannel) {
        return channel;
      }
      console.warn('[NotificationService] Announcement channel is not a text channel');
      return null;
    } catch (error) {
      console.error('[NotificationService] Failed to fetch announcement channel:', error);
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
      console.error('[NotificationService] Cannot send post notification: channel not configured');
      return false;
    }

    try {
      const message = buildPostNotificationMessage(input);
      await channel.send(message);
      console.log(`[NotificationService] Sent post notification for: ${input.post.title}`);
      return true;
    } catch (error) {
      console.error('[NotificationService] Failed to send post notification:', error);
      return false;
    }
  }

  /**
   * Send a round report
   * Requirements: 10.1 - Send round report to designated channel
   */
  async sendRoundReport(data: RoundReportData): Promise<boolean> {
    const channel = await this.getAnnouncementChannel();
    
    if (!channel) {
      console.error('[NotificationService] Cannot send round report: channel not configured');
      return false;
    }

    try {
      const message = buildRoundReportMessage(data);
      await channel.send(message);
      console.log(`[NotificationService] Sent round report for round ${data.round.roundNumber}`);
      return true;
    } catch (error) {
      console.error('[NotificationService] Failed to send round report:', error);
      return false;
    }
  }

  /**
   * Send a round start announcement
   * Requirements: 10.4 - Send round start announcement
   */
  async sendRoundStartAnnouncement(round: Round): Promise<boolean> {
    const channel = await this.getAnnouncementChannel();
    
    if (!channel) {
      console.error('[NotificationService] Cannot send round start: channel not configured');
      return false;
    }

    try {
      const message = buildRoundStartMessage(round);
      await channel.send(message);
      console.log(`[NotificationService] Sent round start announcement for round ${round.roundNumber}`);
      return true;
    } catch (error) {
      console.error('[NotificationService] Failed to send round start announcement:', error);
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
