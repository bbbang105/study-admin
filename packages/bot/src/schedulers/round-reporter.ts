/**
 * Round Reporter Scheduler
 * 회차 종료 시 리포트 자동 발송 및 새 회차 시작 알림
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { Client } from 'discord.js';
import { eq, count } from 'drizzle-orm';
import {
  getDb,
  attendance,
  members,
  posts,
  type Round,
} from '@blog-study/shared/db';
import {
  getCurrentRound,
  getRoundByNumber,
  setCurrentRound,
  isGracePeriodEnded,
} from '../services/round.service';
import {
  getNotificationService,
  calculateRoundReportData,
  type AttendanceSummary,
  type RoundReportData,
} from '../services/notification.service';

/**
 * Result of a round report cycle
 */
export interface RoundReportResult {
  timestamp: Date;
  roundNumber: number;
  reportSent: boolean;
  newRoundStarted: boolean;
  newRoundNumber: number | null;
  errors: string[];
}

/**
 * Get attendance summaries for a round with member info and post counts
 * Requirements: 10.2 - Include submission list, late list, absent list
 * Requirements: 10.3 - Include MVP (member with most posts)
 */
export async function getAttendanceSummariesForRound(
  roundId: number
): Promise<AttendanceSummary[]> {
  const db = getDb();

  // Get all attendance records for the round with member info
  const attendanceRecords = await db
    .select({
      memberId: attendance.memberId,
      status: attendance.status,
      discordId: members.discordId,
      discordUsername: members.discordUsername,
      name: members.name,
    })
    .from(attendance)
    .innerJoin(members, eq(attendance.memberId, members.id))
    .where(eq(attendance.roundId, roundId));

  // Get post counts for each member in this round
  const postCounts = await db
    .select({
      memberId: posts.memberId,
      count: count(),
    })
    .from(posts)
    .where(eq(posts.roundId, roundId))
    .groupBy(posts.memberId);

  // Create a map of member ID to post count
  const postCountMap = new Map<string, number>();
  for (const pc of postCounts) {
    postCountMap.set(pc.memberId, Number(pc.count));
  }

  // Build attendance summaries
  return attendanceRecords.map((record) => ({
    memberId: record.memberId,
    discordId: record.discordId,
    discordUsername: record.discordUsername,
    name: record.name,
    status: record.status as AttendanceSummary['status'],
    postCount: postCountMap.get(record.memberId) || 0,
  }));
}

/**
 * Build round report data from a round
 * Requirements: 10.2 - Generate round report content
 */
export async function buildRoundReportDataForRound(
  round: Round
): Promise<RoundReportData> {
  const summaries = await getAttendanceSummariesForRound(round.id);
  return calculateRoundReportData(round, summaries);
}

/**
 * Round Reporter class for scheduling round reports and announcements
 */
export class RoundReporter {
  private isRunning = false;
  private client: Client | null = null;

  /**
   * Set the Discord client for sending notifications
   */
  setClient(client: Client): void {
    this.client = client;
  }

  /**
   * Get the Discord client
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Check if the reporter is currently running
   */
  isReporting(): boolean {
    return this.isRunning;
  }

  /**
   * Send round report for the completed round
   * Requirements: 10.1 - Automatically generate and send round report
   * Requirements: 10.2 - Include round number, submission list, late list, absent list
   * Requirements: 10.3 - Highlight MVP
   */
  async sendRoundReport(): Promise<RoundReportResult> {
    if (this.isRunning) {
      console.log('[RoundReporter] Report already in progress, skipping');
      return {
        timestamp: new Date(),
        roundNumber: 0,
        reportSent: false,
        newRoundStarted: false,
        newRoundNumber: null,
        errors: ['Report already in progress'],
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    const errors: string[] = [];

    try {
      // Get the current round (which just ended)
      const currentRound = await getCurrentRound();

      // Check if grace period has ended
      if (!isGracePeriodEnded(currentRound)) {
        console.log('[RoundReporter] Grace period not yet ended, skipping report');
        return {
          timestamp: startTime,
          roundNumber: currentRound.roundNumber,
          reportSent: false,
          newRoundStarted: false,
          newRoundNumber: null,
          errors: ['Grace period not yet ended'],
        };
      }

      console.log(`[RoundReporter] Generating report for round ${currentRound.roundNumber}`);

      // Build report data
      const reportData = await buildRoundReportDataForRound(currentRound);

      // Send the report
      const notificationService = getNotificationService();
      const sent = await notificationService.sendRoundReport(reportData);

      if (!sent) {
        errors.push('Failed to send round report');
      }

      console.log(`[RoundReporter] Round ${currentRound.roundNumber} report ${sent ? 'sent' : 'failed'}`);

      return {
        timestamp: startTime,
        roundNumber: currentRound.roundNumber,
        reportSent: sent,
        newRoundStarted: false,
        newRoundNumber: null,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[RoundReporter] Error: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        roundNumber: 0,
        reportSent: false,
        newRoundStarted: false,
        newRoundNumber: null,
        errors,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Send round start announcement for a new round
   * Requirements: 10.4 - Send round start announcement with deadline info
   */
  async sendRoundStartAnnouncement(): Promise<RoundReportResult> {
    const startTime = new Date();
    const errors: string[] = [];

    try {
      // Get the current round
      const currentRound = await getCurrentRound();

      // Check if this is actually the start of a new round
      // (Monday of the round's start week)
      const today = new Date();
      const roundStartDate = new Date(currentRound.startDate + 'T00:00:00.000Z');
      
      // Check if today is the start date of the current round
      const isSameDay = 
        today.getUTCFullYear() === roundStartDate.getUTCFullYear() &&
        today.getUTCMonth() === roundStartDate.getUTCMonth() &&
        today.getUTCDate() === roundStartDate.getUTCDate();

      if (!isSameDay) {
        // Not a round start day, check if we need to advance to next round
        const nextRound = await getRoundByNumber(currentRound.roundNumber + 1);
        
        if (nextRound) {
          const nextRoundStartDate = new Date(nextRound.startDate + 'T00:00:00.000Z');
          const isNextRoundStartDay =
            today.getUTCFullYear() === nextRoundStartDate.getUTCFullYear() &&
            today.getUTCMonth() === nextRoundStartDate.getUTCMonth() &&
            today.getUTCDate() === nextRoundStartDate.getUTCDate();

          if (isNextRoundStartDay) {
            // Advance to next round
            await setCurrentRound(nextRound.roundNumber);
            
            console.log(`[RoundReporter] Starting round ${nextRound.roundNumber}`);

            // Send announcement
            const notificationService = getNotificationService();
            const sent = await notificationService.sendRoundStartAnnouncement(nextRound);

            if (!sent) {
              errors.push('Failed to send round start announcement');
            }

            return {
              timestamp: startTime,
              roundNumber: currentRound.roundNumber,
              reportSent: false,
              newRoundStarted: sent,
              newRoundNumber: nextRound.roundNumber,
              errors,
            };
          }
        }

        console.log('[RoundReporter] Not a round start day, skipping announcement');
        return {
          timestamp: startTime,
          roundNumber: currentRound.roundNumber,
          reportSent: false,
          newRoundStarted: false,
          newRoundNumber: null,
          errors: ['Not a round start day'],
        };
      }

      // Today is the start of the current round - send announcement
      console.log(`[RoundReporter] Sending start announcement for round ${currentRound.roundNumber}`);

      const notificationService = getNotificationService();
      const sent = await notificationService.sendRoundStartAnnouncement(currentRound);

      if (!sent) {
        errors.push('Failed to send round start announcement');
      }

      return {
        timestamp: startTime,
        roundNumber: currentRound.roundNumber,
        reportSent: false,
        newRoundStarted: sent,
        newRoundNumber: currentRound.roundNumber,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[RoundReporter] Error: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        roundNumber: 0,
        reportSent: false,
        newRoundStarted: false,
        newRoundNumber: null,
        errors,
      };
    }
  }

  /**
   * Manually trigger round report for a specific round
   * Useful for admin operations or testing
   */
  async sendReportForRound(roundNumber: number): Promise<RoundReportResult> {
    const startTime = new Date();
    const errors: string[] = [];

    try {
      const round = await getRoundByNumber(roundNumber);
      
      if (!round) {
        return {
          timestamp: startTime,
          roundNumber,
          reportSent: false,
          newRoundStarted: false,
          newRoundNumber: null,
          errors: [`Round ${roundNumber} not found`],
        };
      }

      console.log(`[RoundReporter] Manually generating report for round ${roundNumber}`);

      // Build report data
      const reportData = await buildRoundReportDataForRound(round);

      // Send the report
      const notificationService = getNotificationService();
      const sent = await notificationService.sendRoundReport(reportData);

      if (!sent) {
        errors.push('Failed to send round report');
      }

      return {
        timestamp: startTime,
        roundNumber,
        reportSent: sent,
        newRoundStarted: false,
        newRoundNumber: null,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[RoundReporter] Manual report error: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        roundNumber,
        reportSent: false,
        newRoundStarted: false,
        newRoundNumber: null,
        errors,
      };
    }
  }
}

// Singleton instance
let roundReporterInstance: RoundReporter | null = null;

/**
 * Get the RoundReporter singleton instance
 */
export function getRoundReporter(): RoundReporter {
  if (!roundReporterInstance) {
    roundReporterInstance = new RoundReporter();
  }
  return roundReporterInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetRoundReporter(): void {
  roundReporterInstance = null;
}
