/**
 * Attendance Checker Scheduler
 * 매주 화요일 00:00에 지각/결석 처리
 * Requirements: 5.6
 */

import { getAttendanceService } from '../services/attendance.service';
import { getCurrentRound, isGracePeriodEnded } from '../services/round.service';
import { type Attendance, AttendanceStatus, type Round } from '@blog-study/shared/db';
import logger from '../lib/logger';

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
      logger.warn('✅ [출석] 체크가 이미 진행 중, 스킵');
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
        logger.info('✅ [출석] 유예 기간 미종료, 스킵');
        return {
          timestamp: startTime,
          roundId: currentRound.id,
          roundNumber: currentRound.roundNumber,
          processedCount: 0,
          absentMembers: [],
          errors: ['Grace period not yet ended'],
        };
      }

      logger.info(`✅ [출석] ${currentRound.roundNumber}회차 출석 처리 시작`);

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
            logger.error(`✅ [출석] 콜백 에러 (${record.memberId}): ${errorMsg}`);
            errors.push(`Callback error for ${record.memberId}: ${errorMsg}`);
          }
        }
      }

      logger.info(
        `✅ [출석] 처리 완료 - ${absentRecords.length}명 결석 처리`
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
      logger.error(`✅ [출석] 에러: ${errorMsg}`);
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
      logger.info(`✅ [출석] 수동 처리 시작 (회차 ID: ${roundId})`);

      const attendanceService = getAttendanceService();
      const updatedRecords = await attendanceService.processGracePeriodEnd(roundId);

      const absentRecords = updatedRecords.filter(
        (r) => r.status === AttendanceStatus.ABSENT
      );

      for (const record of absentRecords) {
        absentMembers.push(record.memberId);
      }

      logger.info(
        `✅ [출석] 수동 처리 완료 - ${absentRecords.length}명 결석 처리`
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
      logger.error(`✅ [출석] 수동 처리 에러: ${errorMsg}`);
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
  attendanceCheckerInstance = null;
}
