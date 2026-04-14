/**
 * Popular Posts Scheduler
 * 회차 종료 후 인기 포스트 TOP 5 발송 (화요일 08:01 KST + 수동 트리거)
 */

import {
  ActionRowBuilder,
  bold,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  type MessageCreateOptions,
} from 'discord.js';
import { desc, eq, sql } from 'drizzle-orm';
import logger from '../lib/logger';
import { logNotification } from '../lib/notification-logger';
import { getDb, members, posts } from '@blog-study/shared/db';
import {
  ConfigKeys,
  getConfigValue,
  getCurrentRound,
  getRoundByNumber,
  isGracePeriodEnded,
} from '../services/round.service';

const KUSTING_WEB_URL = 'https://kusting-web.vercel.app';

export interface PopularPostsResult {
  timestamp: Date;
  sent: boolean;
  roundNumber: number | null;
  postCount: number;
  errors: string[];
}

interface PopularPost {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  popularScore: number;
  memberName: string;
  memberNickname: string;
  memberDiscordId: string;
  memberProfileImageUrl: string | null;
}

/**
 * 특정 회차의 인기 포스트 TOP 5 조회
 */
async function getPopularPostsForRound(roundId: number): Promise<PopularPost[]> {
  const db = getDb();

  // 인기 점수 = 댓글×3 + 조회수×2 + 리액션×1
  const popularScore = sql<number>`
    COALESCE(${posts.commentCount}, 0) * 3
    + (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = ${posts.id}) * 2
    + (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = ${posts.id})
  `;

  const topPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      url: posts.url,
      thumbnailUrl: posts.thumbnailUrl,
      commentCount: posts.commentCount,
      memberId: members.id,
      memberName: members.name,
      memberNickname: members.nickname,
      memberDiscordId: members.discordId,
      memberDiscordUsername: members.discordUsername,
      memberProfileImageUrl: members.profileImageUrl,
      score: popularScore,
    })
    .from(posts)
    .leftJoin(members, eq(posts.memberId, members.id))
    .where(eq(posts.roundId, roundId))
    .orderBy(desc(popularScore), desc(posts.commentCount), desc(posts.publishedAt))
    .limit(5);

  return topPosts.map((p) => ({
    id: p.id,
    title: p.title,
    url: p.url,
    thumbnailUrl: p.thumbnailUrl,
    popularScore: Number(p.score),
    memberName: p.memberName!,
    memberNickname: p.memberNickname!,
    memberDiscordId: p.memberDiscordId!,
    memberProfileImageUrl: p.memberProfileImageUrl,
  }));
}

const RANK_EMOJIS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
const RANK_COLORS = [0xFFD700, 0xC0C0C0, 0xCD7F32, 0x87CEEB, 0xB19CD9];

/**
 * 개별 포스트 Embed 생성
 */
function buildPostEmbed(post: PopularPost, rank: number): EmbedBuilder {
  const emoji = RANK_EMOJIS[rank - 1] ?? `${rank}.`;
  const color = RANK_COLORS[rank - 1] ?? 0x5865F2;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} ${rank}위 — ${post.title}`)
    .setURL(post.url)
    .setAuthor({
      name: post.memberNickname || post.memberName,
      iconURL: post.memberProfileImageUrl || undefined,
    })
    .setFooter({
      text: `인기 점수: ${post.popularScore}점`,
    });

  if (post.thumbnailUrl) {
    embed.setThumbnail(post.thumbnailUrl);
  }

  return embed;
}

/**
 * 개별 포스트 버튼 생성
 */
function buildPostButtons(post: PopularPost): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('📖 블로그 원문 보기')
      .setStyle(ButtonStyle.Link)
      .setURL(post.url),
    new ButtonBuilder()
      .setLabel('🔗 큐스팅 웹에서 보기')
      .setStyle(ButtonStyle.Link)
      .setURL(`${KUSTING_WEB_URL}/posts/${post.id}`),
  );
}

/**
 * Popular Posts Scheduler class
 */
export class PopularPosts {
  private isRunning = false;
  private client: Client | null = null;

  setClient(client: Client): void {
    this.client = client;
  }

  getClient(): Client | null {
    return this.client;
  }

  isSending(): boolean {
    return this.isRunning;
  }

  /**
   * 인기 포스트 알림 발송
   * @param force - true면 grace period 체크 건너뜀 (수동 트리거용)
   * @param forceRoundNumber - 특정 회차 번호 지정 (미지정 시 이전 회차)
   */
  async sendPopularPosts(force = false, forceRoundNumber?: number): Promise<PopularPostsResult> {
    if (this.isRunning) {
      logger.info('🏆 [인기 포스트] 이미 실행 중, 건너뜀');
      return {
        timestamp: new Date(),
        sent: false,
        roundNumber: null,
        postCount: 0,
        errors: ['이미 실행 중'],
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    const errors: string[] = [];

    try {
      if (!this.client) {
        throw new Error('Discord client 미설정');
      }

      // 대상 회차 결정
      let targetRound;
      if (forceRoundNumber !== undefined) {
        targetRound = await getRoundByNumber(forceRoundNumber);
        if (!targetRound) throw new Error(`${forceRoundNumber}회차를 찾을 수 없습니다`);
      } else {
        const currentRound = await getCurrentRound();
        targetRound = await getRoundByNumber(currentRound.roundNumber - 1);
        if (!targetRound) throw new Error('이전 회차를 찾을 수 없습니다');
      }

      // grace period 체크 (수동/특정 회차 지정 시 건너뜀)
      if (!force && !forceRoundNumber) {
        if (!isGracePeriodEnded(targetRound)) {
          logger.info(`🏆 [인기 포스트] ${targetRound.roundNumber}회차 유예 기간 미종료, 건너뜀`);
          return {
            timestamp: startTime,
            sent: false,
            roundNumber: targetRound.roundNumber,
            postCount: 0,
            errors: ['유예 기간 미종료'],
          };
        }

        // 이미 보고된 회차 중복 발송 방지: grace period 종료 후 4일 이내만 발송
        const graceEndMs = new Date(targetRound.graceEndDate + 'T23:59:59+09:00').getTime();
        const daysSinceGraceEnd = (Date.now() - graceEndMs) / (1000 * 60 * 60 * 24);
        if (daysSinceGraceEnd > 4) {
          logger.info(
            `🏆 [인기 포스트] ${targetRound.roundNumber}회차 유예 기간이 ${Math.floor(daysSinceGraceEnd)}일 전 종료됨, 이미 발송된 것으로 간주하여 건너뜀`
          );
          return {
            timestamp: startTime,
            sent: false,
            roundNumber: targetRound.roundNumber,
            postCount: 0,
            errors: ['이미 발송된 회차 (유예 기간 종료 후 4일 초과)'],
          };
        }
      }

      logger.info(`🏆 [인기 포스트] ${targetRound.roundNumber}회차 인기 포스트 조회 중...`);

      const popularPosts = await getPopularPostsForRound(targetRound.id);

      if (popularPosts.length === 0) {
        logger.info('🏆 [인기 포스트] 해당 회차에 포스트 없음');
        return {
          timestamp: startTime,
          sent: false,
          roundNumber: targetRound.roundNumber,
          postCount: 0,
          errors: ['포스트 없음'],
        };
      }

      // 채널 조회
      const channelId = await getConfigValue(ConfigKeys.POPULAR_POSTS_CHANNEL_ID);
      if (!channelId) throw new Error('popular_posts_channel_id 미설정');

      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        throw new Error(`유효하지 않은 채널: ${channelId}`);
      }

      // 1. 헤더 메시지 발송
      const headerEmbed = new EmbedBuilder()
        .setColor(0xFF6B9D)
        .setTitle(`🏆 ${targetRound.roundNumber}회차 인기 포스트 TOP ${popularPosts.length}`)
        .setDescription(
          `${targetRound.startDate} ~ ${targetRound.endDate} 기간 동안 가장 인기 있었던 포스트입니다!\n` +
          `점수 산정 기준: ${bold('댓글 × 3 + 조회수 × 2 + 리액션 × 1')}`
        )
        .setTimestamp();

      const headerSent = await channel.send({
        content: '@everyone',
        embeds: [headerEmbed],
        allowedMentions: { parse: ['everyone'] },
      });
      await logNotification({
        source: 'bot',
        type: 'popular_posts',
        channelId: channel.id,
        channelName: 'name' in channel ? String((channel as any).name) : undefined,
        messageId: headerSent.id,
        summary: `${targetRound.roundNumber}회차 인기 포스트 헤더`,
        status: 'sent',
      });

      // 2. 개별 포스트 순차 발송 (1위 → 5위)
      for (let i = 0; i < popularPosts.length; i++) {
        const post = popularPosts[i]!;
        const rank = i + 1;

        const embed = buildPostEmbed(post, rank);
        const buttons = buildPostButtons(post);

        const message: MessageCreateOptions = {
          embeds: [embed],
          components: [buttons],
        };

        const sent = await channel.send(message);
        await logNotification({
          source: 'bot',
          type: 'popular_posts',
          channelId: channel.id,
          channelName: 'name' in channel ? String((channel as any).name) : undefined,
          messageId: sent.id,
          summary: `${targetRound.roundNumber}회차 인기 ${rank}위: ${post.title}`.slice(0, 200),
          metadata: { memberDiscordId: post.memberDiscordId, rank },
          status: 'sent',
        });
      }

      logger.info(
        `🏆 [인기 포스트] ${targetRound.roundNumber}회차 TOP ${popularPosts.length} 발송 완료 ✅`
      );

      return {
        timestamp: startTime,
        sent: true,
        roundNumber: targetRound.roundNumber,
        postCount: popularPosts.length,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await logNotification({
        source: 'bot',
        type: 'popular_posts',
        summary: '인기 포스트 발표',
        status: 'failed',
        errorMessage: errorMsg,
      });
      logger.error(`🏆 [인기 포스트] 에러: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        sent: false,
        roundNumber: null,
        postCount: 0,
        errors,
      };
    } finally {
      this.isRunning = false;
    }
  }
}

// Singleton instance
let popularPostsInstance: PopularPosts | null = null;

export function getPopularPosts(): PopularPosts {
  if (!popularPostsInstance) {
    popularPostsInstance = new PopularPosts();
  }
  return popularPostsInstance;
}

export function resetPopularPosts(): void {
  popularPostsInstance = null;
}
