/**
 * Discord Activity Score Handler
 * 메시지, 스레드 댓글, 리액션 이벤트를 감지하여 점수를 부여
 */

import type { Client, Message } from 'discord.js';
import { Events } from 'discord.js';
import { ActivityScoreType } from '@blog-study/shared/db';
import { getScoreService } from '../services/score.service';
import logger from '../lib/logger';

const MIN_MESSAGE_LENGTH = 10;

/**
 * 디스코드 활동 점수 이벤트 핸들러 등록
 */
export function setupActivityHandler(client: Client): void {
  const scoreService = getScoreService();

  // 메시지 작성 (채널 메시지 + 스레드 댓글 구분)
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      // 봇 메시지 무시
      if (message.author.bot) return;

      // DM 무시
      if (!message.guild) return;

      // 최소 글자수 미달
      if (message.content.length < MIN_MESSAGE_LENGTH) return;

      const memberId = await scoreService.getMemberIdByDiscordId(message.author.id);
      if (!memberId) return; // 스터디원이 아닌 경우

      // 스레드 안에서의 메시지 = 스레드 댓글 (+3점)
      // 일반 채널 메시지 = 메시지 (+2점)
      const isThread = message.channel.isThread();
      const type = isThread
        ? ActivityScoreType.DISCORD_THREAD
        : ActivityScoreType.DISCORD_MESSAGE;

      await scoreService.grantScore(memberId, type);
    } catch (error) {
      logger.error({ error }, 'Activity score error (message)');
    }
  });

  // 리액션 달기
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      // 봇 리액션 무시
      if (user.bot) return;

      // partial인 경우 fetch
      if (reaction.partial) {
        await reaction.fetch();
      }

      // 자기 글에 자기가 리액션 → 무시
      if (reaction.message.author?.id === user.id) return;

      const memberId = await scoreService.getMemberIdByDiscordId(user.id);
      if (!memberId) return;

      await scoreService.grantScore(memberId, ActivityScoreType.DISCORD_REACTION);
    } catch (error) {
      logger.error({ error }, 'Activity score error (reaction)');
    }
  });

  logger.info('Activity score handler registered');
}
