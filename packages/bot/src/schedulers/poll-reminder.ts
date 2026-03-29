/**
 * Poll Reminder (Manual Only)
 * 관리자가 수동으로 특정 투표의 미참여자에게 DM 발송
 */

import { Client } from 'discord.js';
import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import { boardPolls, boardPollVotes, getDb, members, MemberStatus } from '@blog-study/shared/db';
import { sendPollReminderDM } from '../handlers/dm-handler';
import logger from '../lib/logger';

export interface PollReminderResult {
  timestamp: Date;
  pollsProcessed: number;
  dmsSent: number;
  dmsFailed: number;
  errors: string[];
}

export class PollReminder {
  private isRunning = false;
  private client: Client | null = null;

  setClient(client: Client): void {
    this.client = client;
  }

  isReminding(): boolean {
    return this.isRunning;
  }

  /**
   * 수동 실행: 특정 투표의 미참여자에게 DM 발송
   * @param targetDiscordId 지정 시 해당 멤버에게만 발송
   */
  async sendRemindersForPoll(pollId: string, targetDiscordId?: string): Promise<PollReminderResult> {
    if (this.isRunning) {
      return {
        timestamp: new Date(),
        pollsProcessed: 0,
        dmsSent: 0,
        dmsFailed: 0,
        errors: ['이미 실행 중'],
      };
    }

    if (!this.client) {
      return {
        timestamp: new Date(),
        pollsProcessed: 0,
        dmsSent: 0,
        dmsFailed: 0,
        errors: ['Discord 클라이언트 미설정'],
      };
    }

    this.isRunning = true;
    const startTime = new Date();

    try {
      const db = getDb();

      const [poll] = await db
        .select({
          id: boardPolls.id,
          question: boardPolls.question,
          expiresAt: boardPolls.expiresAt,
          postId: boardPolls.postId,
          isAnonymous: boardPolls.isAnonymous,
        })
        .from(boardPolls)
        .where(and(eq(boardPolls.id, pollId), isNull(boardPolls.deletedAt)))
        .limit(1);

      if (!poll) {
        return {
          timestamp: startTime,
          pollsProcessed: 0,
          dmsSent: 0,
          dmsFailed: 0,
          errors: ['투표를 찾을 수 없습니다'],
        };
      }

      if (poll.isAnonymous) {
        return {
          timestamp: startTime,
          pollsProcessed: 0,
          dmsSent: 0,
          dmsFailed: 0,
          errors: ['익명 투표는 리마인더를 보낼 수 없습니다'],
        };
      }

      if (new Date(poll.expiresAt) < new Date()) {
        return {
          timestamp: startTime,
          pollsProcessed: 0,
          dmsSent: 0,
          dmsFailed: 0,
          errors: ['이미 마감된 투표입니다'],
        };
      }

      const result = await this.sendDMsToNonVoters(
        poll.id,
        poll.question,
        poll.expiresAt,
        poll.postId,
        targetDiscordId,
      );

      logger.info(
        `📊 [투표 리마인더] 수동 실행 완료 — DM ${result.sent}건, 실패 ${result.failed}건`
      );

      return {
        timestamp: startTime,
        pollsProcessed: 1,
        dmsSent: result.sent,
        dmsFailed: result.failed,
        errors: [],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error }, '📊 [투표 리마인더] 수동 실행 에러');
      return {
        timestamp: startTime,
        pollsProcessed: 0,
        dmsSent: 0,
        dmsFailed: 0,
        errors: [msg],
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 특정 투표의 미참여자에게 DM 발송
   */
  private async sendDMsToNonVoters(
    pollId: string,
    question: string,
    expiresAt: Date,
    postId: string,
    targetDiscordId?: string,
  ): Promise<{ sent: number; failed: number }> {
    const db = getDb();
    let sent = 0;
    let failed = 0;

    // 특정 멤버 지정 시 해당 멤버에게만 발송
    if (targetDiscordId) {
      const [target] = await db
        .select({ discordId: members.discordId, name: members.name })
        .from(members)
        .where(eq(members.discordId, targetDiscordId))
        .limit(1);

      if (!target) {
        logger.warn({ targetDiscordId }, '📊 [투표 리마인더] 대상 멤버를 찾을 수 없음');
        return { sent: 0, failed: 1 };
      }

      logger.info(`📊 [투표 리마인더] "${question}" — ${target.name}에게 개별 발송`);

      try {
        const success = await sendPollReminderDM(this.client!, target.discordId, question, expiresAt, postId);
        return success ? { sent: 1, failed: 0 } : { sent: 0, failed: 1 };
      } catch {
        return { sent: 0, failed: 1 };
      }
    }

    // 이미 투표한 멤버 ID 조회
    const voters = await db
      .select({ memberId: boardPollVotes.memberId })
      .from(boardPollVotes)
      .where(eq(boardPollVotes.pollId, pollId));

    const voterMemberIds = voters
      .map((v) => v.memberId)
      .filter((id): id is string => id !== null);

    // eligible 멤버 중 미투표자 조회 (단일 쿼리)
    const statusFilter = inArray(members.status, [MemberStatus.ACTIVE, MemberStatus.OB, MemberStatus.DORMANT]);
    const nonVoterMembers = await db
      .select({ discordId: members.discordId, name: members.name })
      .from(members)
      .where(
        voterMemberIds.length > 0
          ? and(statusFilter, notInArray(members.id, voterMemberIds))
          : statusFilter
      );

    logger.info(`📊 [투표 리마인더] "${question}" — 미참여 ${nonVoterMembers.length}명`);

    for (const member of nonVoterMembers) {
      try {
        const success = await sendPollReminderDM(
          this.client!,
          member.discordId,
          question,
          expiresAt,
          postId,
        );

        if (success) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return { sent, failed };
  }
}

// Singleton
let instance: PollReminder | null = null;

export function getPollReminder(): PollReminder {
  if (!instance) {
    instance = new PollReminder();
  }
  return instance;
}
