/**
 * Fine Reminder Scheduler
 * 미납 벌금 3일마다 리마인드
 * Requirements: 8.4
 */

import { Client } from 'discord.js';
import { getFineService } from '../services/fine.service';
import { sendFineReminder } from '../handlers/dm-handler';

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
   * Send reminders for all unpaid fines that are older than 3 days
   * Requirements: 8.4 - Send reminder every 3 days for unpaid fines
   */
  async sendReminders(): Promise<FineReminderResult> {
    if (this.isRunning) {
      console.log('[FineReminder] Reminder already in progress, skipping');
      return {
        timestamp: new Date(),
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors: ['Reminder already in progress'],
      };
    }

    if (!this.client) {
      console.error('[FineReminder] Discord client not set');
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

      // Get all unpaid fines with member info
      const finesWithInfo = await fineService.getFinesWithMemberInfo();

      // P1 #10: 3일마다 리마인드 로직 수정
      // lastReminderAt을 확인하여 정확히 3일 간격으로 리마인드 발송
      const now = new Date();

      const finesNeedingReminder = finesWithInfo.filter(({ fine }) => {
        // 미납 벌금만 대상
        if (fine.status !== 'PENDING') return false;

        const createdAt = fine.createdAt ? new Date(fine.createdAt) : new Date();

        // 벌금 생성 후 최소 3일 경과했는지 확인
        const threeDaysSinceCreation = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
        if (now < threeDaysSinceCreation) return false;

        // 마지막 리마인드가 없거나, 3일 이상 경과했는지 확인
        const lastReminderAt = fine.lastReminderAt ? new Date(fine.lastReminderAt) : null;
        if (!lastReminderAt) {
          // 첫 리마인드: 생성 3일 이후 경과함 (위에서 이미 확인됨)
          return true;
        }

        // 이전 리마인드로부터 3일 이상 경과했는지 확인
        const threeDaysSinceLastReminder = new Date(lastReminderAt.getTime() + 3 * 24 * 60 * 60 * 1000);
        return now >= threeDaysSinceLastReminder;
      });

      console.log(
        `[FineReminder] Found ${finesNeedingReminder.length} fines needing reminders`
      );

      // Send reminders
      for (const { fine, discordId, roundNumber } of finesNeedingReminder) {
        const createdAt = fine.createdAt ? new Date(fine.createdAt) : new Date();
        const daysSinceCreation = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        try {
          const success = await sendFineReminder(
            this.client,
            discordId,
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
          console.error(`[FineReminder] Error sending reminder: ${errorMsg}`);
          errors.push(`Failed to send reminder for fine ${fine.id}: ${errorMsg}`);
          failedCount++;
        }
      }

      console.log(
        `[FineReminder] Completed - sent ${sentCount}, failed ${failedCount}`
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
      console.error(`[FineReminder] Error: ${errorMsg}`);
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
   * Manually trigger reminders for all unpaid fines
   * Useful for admin operations or testing
   */
  async sendAllReminders(): Promise<FineReminderResult> {
    if (!this.client) {
      console.error('[FineReminder] Discord client not set');
      return {
        timestamp: new Date(),
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors: ['Discord client not set'],
      };
    }

    const startTime = new Date();
    const errors: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    try {
      const fineService = getFineService();
      const finesWithInfo = await fineService.getFinesWithMemberInfo();

      console.log(
        `[FineReminder] Manually sending reminders for ${finesWithInfo.length} unpaid fines`
      );

      const now = new Date();

      for (const { fine, discordId, roundNumber } of finesWithInfo) {
        const createdAt = fine.createdAt ? new Date(fine.createdAt) : new Date();
        const daysSinceCreation = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        try {
          const success = await sendFineReminder(
            this.client,
            discordId,
            fine.id,
            fine.amount,
            fine.type as 'late' | 'absent',
            roundNumber,
            daysSinceCreation
          );

          if (success) {
            sentCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to send reminder for fine ${fine.id}: ${errorMsg}`);
          failedCount++;
        }
      }

      console.log(
        `[FineReminder] Manual reminders completed - sent ${sentCount}, failed ${failedCount}`
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
      console.error(`[FineReminder] Manual reminder error: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors,
      };
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
