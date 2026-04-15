/**
 * Fine Reminder Scheduler
 * 미납 벌금 매일 리마인드
 * Requirements: 8.4
 */

import { Client } from 'discord.js';
import { and, eq } from 'drizzle-orm';
import { attendance, AttendanceStatus, getDb, members, MemberStatus } from '@blog-study/shared/db';
import { getFineService } from '../services/fine.service';
import { sendFineReminder } from '../handlers/dm-handler';
import { getCurrentRound } from '../services/round.service';
import logger from '../lib/logger';
import { sendReminderPush } from '../lib/push-client';

/**
 * Result of a fine reminder cycle
 */
export interface FineReminderResult {
  timestamp: Date;
  processedCount: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Fine Reminder class for scheduling fine reminder notifications
 */
export class FineReminder {
  private isRunning = false;
  private client: Client | null = null;

  /**
   * Set the Discord client for sending DMs
   */
  setClient(client: Client): void {
    this.client = client;
  }

  /**
   * Check if the reminder is currently running
   */
  isReminding(): boolean {
    return this.isRunning;
  }

  /**
   * 지각 기간(월요일)에 아직 PENDING인 멤버에게 푸시 발송
   * "오늘 안에 제출하면 결석은 피할 수 있어요!"
   */
  private async sendGracePeriodNudge(): Promise<void> {
    try {
      const currentRound = await getCurrentRound().catch(() => null);
      if (!currentRound) return;

      // 지각 기간: 정상 마감(graceEndDate 00:00) 이후 ~ 지각 마감(graceEndDate 23:59) 사이
      const now = new Date();
      const submissionDeadline = new Date(`${currentRound.graceEndDate}T00:00:00.000+09:00`);
      const graceEnd = new Date(`${currentRound.graceEndDate}T23:59:59.999+09:00`);

      if (now <= submissionDeadline || now > graceEnd) return;

      // PENDING 상태인 active 멤버 조회
      const db = getDb();
      const pendingMembers = await db
        .select({
          id: members.id,
          nickname: members.nickname,
        })
        .from(attendance)
        .innerJoin(members, eq(attendance.memberId, members.id))
        .where(
          and(
            eq(attendance.roundId, currentRound.id),
            eq(attendance.status, AttendanceStatus.PENDING),
            eq(members.status, MemberStatus.ACTIVE),
          )
        );

      if (pendingMembers.length === 0) return;

      logger.info(`✍️ [지각 독촉] 미제출 멤버 ${pendingMembers.length}명에게 푸시 발송`);

      const memberIds = pendingMembers.map((m) => m.id);
      await sendReminderPush({
        type: 'grace_nudge',
        memberIds,
        title: '아직 시간이 있어요!',
        body: `${currentRound.roundNumber}회차 마감은 지났지만, 오늘 안에 제출하면 결석은 피할 수 있어요.`,
        clickUrl: '/dashboard',
      });
    } catch (error) {
      logger.error({ error }, '✍️ [지각 독촉] 에러');
    }
  }

  /**
   * Send reminders for all unpaid fines that are older than 1 day
   * Requirements: 8.4 - Send daily reminder for unpaid fines
   */
  async sendReminders(): Promise<FineReminderResult> {
    if (this.isRunning) {
      logger.info('⏰ [벌금 리마인더] 이미 실행 중, 건너뜀');
      return {
        timestamp: new Date(),
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors: ['이미 실행 중'],
      };
    }

    if (!this.client) {
      logger.error('⏰ [벌금 리마인더] Discord 클라이언트 미설정');
      return {
        timestamp: new Date(),
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors: ['Discord 클라이언트 미설정'],
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    const errors: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    try {
      // 지각 기간이면 PENDING 멤버에게 독촉 DM 발송
      await this.sendGracePeriodNudge();

      const fineService = getFineService();

      // Get all unpaid fines with member info
      const finesWithInfo = await fineService.getFinesWithMemberInfo();

      // 매일 리마인드 로직: lastReminderAt 확인하여 1일 간격으로 발송
      const now = new Date();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      const finesNeedingReminder = finesWithInfo.filter(({ fine }) => {
        if (fine.status !== 'PENDING') return false;

        const createdAt = fine.createdAt ? new Date(fine.createdAt) : new Date();

        // 벌금 생성 후 최소 1일 경과했는지 확인
        if (now.getTime() - createdAt.getTime() < ONE_DAY_MS) return false;

        // 마지막 리마인드가 없거나, 1일 이상 경과했는지 확인
        const lastReminderAt = fine.lastReminderAt ? new Date(fine.lastReminderAt) : null;
        if (!lastReminderAt) return true;

        return now.getTime() - lastReminderAt.getTime() >= ONE_DAY_MS;
      });

      logger.info(
        `⏰ [벌금 리마인더] 발송 대상 ${finesNeedingReminder.length}건`
      );

      // Send reminders
      for (const { fine, roundNumber } of finesNeedingReminder) {
        const createdAt = fine.createdAt ? new Date(fine.createdAt) : new Date();
        const daysSinceCreation = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        try {
          const success = await sendFineReminder(
            fine.memberId,
            fine.id,
            fine.amount,
            fine.type as 'late' | 'absent',
            roundNumber,
            daysSinceCreation
          );

          if (success) {
            sentCount++;
            // P1 #10: 리마인드 발송 후 lastReminderAt 업데이트
            await fineService.updateLastReminderAt(fine.id);
          } else {
            failedCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`⏰ [벌금 리마인더] 발송 실패: ${errorMsg}`);
          errors.push(`벌금 ${fine.id} 리마인더 발송 실패: ${errorMsg}`);
          failedCount++;
        }
      }

      logger.info(
        `⏰ [벌금 리마인더] 완료 — 발송 ${sentCount}건, 실패 ${failedCount}건`
      );

      return {
        timestamp: startTime,
        processedCount: finesNeedingReminder.length,
        sentCount,
        failedCount,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`⏰ [벌금 리마인더] 에러: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 수동 실행: 모든 미납 벌금에 대해 리마인더 발송
   * - 24시간 간격 체크 없음
   * - lastReminderAt 업데이트 안 함 (다음날 자동 발송에 영향 없음)
   */
  async sendAllReminders(): Promise<FineReminderResult> {
    if (this.isRunning) {
      logger.info('⏰ [벌금 리마인더] 이미 실행 중, 수동 실행 건너뜀');
      return {
        timestamp: new Date(),
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors: ['Reminder already in progress'],
      };
    }

    if (!this.client) {
      logger.error('[FineReminder] Discord client not set');
      return {
        timestamp: new Date(),
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors: ['Discord client not set'],
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    const errors: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    try {
      const fineService = getFineService();
      const finesWithInfo = await fineService.getFinesWithMemberInfo();

      logger.info(
        `[FineReminder] Manually sending reminders for ${finesWithInfo.length} unpaid fines`
      );

      const now = new Date();

      for (const { fine, roundNumber } of finesWithInfo) {
        const createdAt = fine.createdAt ? new Date(fine.createdAt) : new Date();
        const daysSinceCreation = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        try {
          const success = await sendFineReminder(
            fine.memberId,
            fine.id,
            fine.amount,
            fine.type as 'late' | 'absent',
            roundNumber,
            daysSinceCreation
          );

          if (success) {
            sentCount++;
            // 수동 실행이므로 lastReminderAt 업데이트 안 함
          } else {
            failedCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`벌금 ${fine.id} 리마인더 발송 실패: ${errorMsg}`);
          failedCount++;
        }
      }

      logger.info(
        `⏰ [벌금 리마인더] 수동 실행 완료 — 발송 ${sentCount}건, 실패 ${failedCount}건`
      );

      return {
        timestamp: startTime,
        processedCount: finesWithInfo.length,
        sentCount,
        failedCount,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[FineReminder] Manual reminder error: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors,
      };
    } finally {
      this.isRunning = false;
    }
  }
}

// Singleton instance
let fineReminderInstance: FineReminder | null = null;

/**
 * Get the FineReminder singleton instance
 */
export function getFineReminder(): FineReminder {
  if (!fineReminderInstance) {
    fineReminderInstance = new FineReminder();
  }
  return fineReminderInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetFineReminder(): void {
  fineReminderInstance = null;
}
