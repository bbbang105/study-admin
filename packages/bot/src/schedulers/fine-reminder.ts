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

      // Filter fines that need reminders (created more than 3 days ago)
      // and check if today is a reminder day (every 3 days)
      const now = new Date();
      const finesNeedingReminder = finesWithInfo.filter(({ fine }) => {
        const createdAt = fine.createdAt ? new Date(fine.createdAt) : new Date();
        const daysSinceCreation = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Send reminder if 3+ days have passed and it's a multiple of 3 days
        return daysSinceCreation >= 3 && daysSinceCreation % 3 === 0;
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
