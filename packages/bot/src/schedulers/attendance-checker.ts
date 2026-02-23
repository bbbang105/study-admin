/**
 * Attendance Checker Scheduler
 * 매주 화요일 00:00에 지각/결석 처리
 * Requirements: 5.6
 */

import cron from 'node-cron';
import { getAttendanceService } from '../services/attendance.service';
import { getCurrentRound, isGracePeriodEnded } from '../services/round.service';
import { AttendanceStatus, type Attendance, type Round } from '@blog-study/shared/db';

/**
 * Result of an attendance check cycle
 */
export interface AttendanceCheckResult {
  timestamp: Date;
  roundId: number;
  roundNumber: number;
  processedCount: number;
  absentMembers: string[];
  errors: string[];
}

/**
 * Callback for when attendance is marked as absent
 */
export type OnAbsentCallback = (
  attendance: Attendance,
  round: Round
) => Promise<void>;

/**
 * Attendance Checker class for scheduling attendance processing
 */
export class AttendanceChecker {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private onAbsent: OnAbsentCallback | null = null;

  /**
   * Set callback for when a member is marked absent
   * This can be used to create fines or send notifications
   */
  setOnAbsentCallback(callback: OnAbsentCallback): void {
    this.onAbsent = callback;
  }

  /**
   * Start the attendance checker scheduler
   * Runs every Tuesday at 00:00 (after grace period ends)
   * Requirements: 5.6
   */
  start(): void {
    if (this.cronJob) {
      console.log('[AttendanceChecker] Already running');
      return;
    }

    // Run every Tuesday at 00:00: 0 0 * * 2
    // Tuesday is day 2 in cron (0 = Sunday, 1 = Monday, 2 = Tuesday)
    this.cronJob = cron.schedule('0 0 * * 2', async () => {
      await this.check();
    });

    console.log('[AttendanceChecker] Started - checking every Tuesday at 00:00');
  }

  /**
   * Stop the attendance checker scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[AttendanceChecker] Stopped');
    }
  }

  /**
   * Check if the checker is currently running
   */
  isChecking(): boolean {
    return this.isRunning;
  }

  /**
   * Run an attendance check cycle
   * Marks all pending attendance records as absent for the previous round
   * Requirements: 5.6 - When grace period ends, pending -> absent
   */
  async check(): Promise<AttendanceCheckResult> {
    if (this.isRunning) {
      console.log('[AttendanceChecker] Check already in progress, skipping');
      return {
        timestamp: new Date(),
        roundId: 0,
        roundNumber: 0,
        processedCount: 0,
        absentMembers: [],
        errors: ['Check already in progress'],
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    const errors: string[] = [];
    const absentMembers: string[] = [];

    try {
      // Get the current round
      const currentRound = await getCurrentRound();
      
      // Check if grace period has ended for this round
      if (!isGracePeriodEnded(currentRound)) {
        console.log('[AttendanceChecker] Grace period not yet ended, skipping');
        return {
          timestamp: startTime,
          roundId: currentRound.id,
          roundNumber: currentRound.roundNumber,
          processedCount: 0,
          absentMembers: [],
          errors: ['Grace period not yet ended'],
        };
      }

      console.log(`[AttendanceChecker] Processing round ${currentRound.roundNumber}`);

      // Process grace period end - mark all pending as absent
      const attendanceService = getAttendanceService();
      const updatedRecords = await attendanceService.processGracePeriodEnd(currentRound.id);

      // Filter to only those that were actually marked absent
      const absentRecords = updatedRecords.filter(
        (r) => r.status === AttendanceStatus.ABSENT
      );

      // Call the callback for each absent member
      for (const record of absentRecords) {
        absentMembers.push(record.memberId);
        
        if (this.onAbsent) {
          try {
            await this.onAbsent(record, currentRound);
          } catch (callbackError) {
            const errorMsg = callbackError instanceof Error
              ? callbackError.message
              : String(callbackError);
            console.error(`[AttendanceChecker] Callback error for ${record.memberId}: ${errorMsg}`);
            errors.push(`Callback error for ${record.memberId}: ${errorMsg}`);
          }
        }
      }

      console.log(
        `[AttendanceChecker] Completed - ${absentRecords.length} members marked absent`
      );

      return {
        timestamp: startTime,
        roundId: currentRound.id,
        roundNumber: currentRound.roundNumber,
        processedCount: absentRecords.length,
        absentMembers,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[AttendanceChecker] Error: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        roundId: 0,
        roundNumber: 0,
        processedCount: 0,
        absentMembers: [],
        errors,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger attendance check for a specific round
   * Useful for admin operations or testing
   */
  async checkRound(roundId: number): Promise<AttendanceCheckResult> {
    const startTime = new Date();
    const errors: string[] = [];
    const absentMembers: string[] = [];

    try {
      console.log(`[AttendanceChecker] Manually processing round ID ${roundId}`);

      const attendanceService = getAttendanceService();
      const updatedRecords = await attendanceService.processGracePeriodEnd(roundId);

      const absentRecords = updatedRecords.filter(
        (r) => r.status === AttendanceStatus.ABSENT
      );

      for (const record of absentRecords) {
        absentMembers.push(record.memberId);
      }

      console.log(
        `[AttendanceChecker] Manual check completed - ${absentRecords.length} members marked absent`
      );

      return {
        timestamp: startTime,
        roundId,
        roundNumber: 0, // Unknown for manual check
        processedCount: absentRecords.length,
        absentMembers,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[AttendanceChecker] Manual check error: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: startTime,
        roundId,
        roundNumber: 0,
        processedCount: 0,
        absentMembers: [],
        errors,
      };
    }
  }
}

// Singleton instance
let attendanceCheckerInstance: AttendanceChecker | null = null;

/**
 * Get the AttendanceChecker singleton instance
 */
export function getAttendanceChecker(): AttendanceChecker {
  if (!attendanceCheckerInstance) {
    attendanceCheckerInstance = new AttendanceChecker();
  }
  return attendanceCheckerInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetAttendanceChecker(): void {
  if (attendanceCheckerInstance) {
    attendanceCheckerInstance.stop();
  }
  attendanceCheckerInstance = null;
}
