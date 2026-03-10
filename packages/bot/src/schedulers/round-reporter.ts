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
  rounds,
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
 * Format KST date to ISO date string (YYYY-MM-DD)
 * P0 #6: KST 기준 날짜 포맷팅 (UTC+9)
 */
function formatKSTDate(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000; // UTC+9
  const kstDate = new Date(date.getTime() + kstOffset);
  return kstDate.toISOString().split('T')[0]!;
}

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

      // P0 #7: 회차 종료 후 isCurrent 플래그 업데이트
      // 다음 회차가 있으면 해당 회차를 current로 설정
      const nextRound = await getRoundByNumber(currentRound.roundNumber + 1);
      if (nextRound) {
        await setCurrentRound(nextRound.roundNumber);
        console.log(`[RoundReporter] Updated current round to ${nextRound.roundNumber}`);
      } else {
        // 다음 회차가 없으면 현재 회차의 isCurrent를 false로 변경
        const db = getDb();
        await db
          .update(rounds)
          .set({ isCurrent: false })
          .where(eq(rounds.id, currentRound.id));
        console.log(`[RoundReporter] No next round, unset isCurrent for round ${currentRound.roundNumber}`);
      }

      return {
        timestamp: startTime,
        roundNumber: currentRound.roundNumber,
        reportSent: sent,
        newRoundStarted: nextRound !== null,
        newRoundNumber: nextRound?.roundNumber ?? null,
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
   * P0 #6: KST 타임존 기준으로 날짜 비교
   */
  async sendRoundStartAnnouncement(): Promise<RoundReportResult> {
    const startTime = new Date();
    const errors: string[] = [];

    try {
      // Get the current round
      const currentRound = await getCurrentRound();

      // P0 #6: KST 기준으로 오늘 날짜 구하기
      const todayStr = formatKSTDate(new Date());

      // 회차 시작일과 비교 (KST 기준)
      const isTodayRoundStart = todayStr === currentRound.startDate;

      if (isTodayRoundStart) {
        // 오늘이 현재 회차 시작일 - 알림 발송
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
      }

      // 오늘이 현재 회차 시작일이 아니면, 다음 회차 시작일인지 확인
      const nextRound = await getRoundByNumber(currentRound.roundNumber + 1);

      if (nextRound && todayStr === nextRound.startDate) {
        // 오늘이 다음 회차 시작일 - 회차 전환 + 알림 발송
        await setCurrentRound(nextRound.roundNumber);

        console.log(`[RoundReporter] Starting round ${nextRound.roundNumber}`);

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

      // 회차 시작일이 아님
      console.log('[RoundReporter] Not a round start day, skipping announcement');
      return {
        timestamp: startTime,
        roundNumber: currentRound.roundNumber,
        reportSent: false,
        newRoundStarted: false,
        newRoundNumber: null,
        errors: ['Not a round start day'],
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
