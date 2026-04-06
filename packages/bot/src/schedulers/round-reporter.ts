/**
 * Round Reporter Scheduler
 * 회차 종료 시 리포트 자동 발송 및 새 회차 시작 알림
 */

import { Client } from 'discord.js';
import { and, count, eq } from 'drizzle-orm';
import logger from '../lib/logger';
import { attendance, getDb, members, posts, type Round } from '@blog-study/shared/db';
import { getCurrentRound, getRoundByNumber, isGracePeriodEnded } from '../services/round.service';
import {
  type AttendanceSummary,
  calculateRoundReportData,
  getNotificationService,
  type RoundReportData,
} from '../services/notification.service';
import { formatKSTDate } from '@blog-study/shared/utils';

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
 */
export async function getAttendanceSummariesForRound(
  roundId: number
): Promise<AttendanceSummary[]> {
  const db = getDb();

  const results = await db
    .select({
      memberId: attendance.memberId,
      status: attendance.status,
      discordId: members.discordId,
      discordUsername: members.discordUsername,
      name: members.name,
      postCount: count(posts.id),
    })
    .from(attendance)
    .innerJoin(members, eq(attendance.memberId, members.id))
    .leftJoin(posts, and(eq(posts.memberId, attendance.memberId), eq(posts.roundId, roundId)))
    .where(eq(attendance.roundId, roundId))
    .groupBy(attendance.memberId, attendance.status, members.discordId, members.discordUsername, members.name);

  return results.map((row) => ({
    memberId: row.memberId,
    discordId: row.discordId,
    discordUsername: row.discordUsername,
    name: row.name,
    status: row.status as AttendanceSummary['status'],
    postCount: Number(row.postCount),
  }));
}

/**
 * Build report data from a round
 */
async function buildRoundReportDataForRound(round: Round): Promise<RoundReportData> {
  const summaries = await getAttendanceSummariesForRound(round.id);
  return calculateRoundReportData(round, summaries);
}

/**
 * Round Reporter class
 */
export class RoundReporter {
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
   * 회차 리포트 발송
   * @param force - true면 grace period 체크 건너뜀 (수동 트리거용)
   */
  async sendRoundReport(force = false): Promise<RoundReportResult> {
    if (this.isRunning) {
      logger.info('📊 [회차 리포트] 이미 실행 중, 건너뜀');
      return {
        timestamp: new Date(),
        roundNumber: 0,
        reportSent: false,
        newRoundStarted: false,
        newRoundNumber: null,
        errors: ['이미 실행 중'],
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    const errors: string[] = [];

    try {
      const currentRound = await getCurrentRound();

      // 현재 회차의 이전 회차(종료된 회차)를 가져와서 리포트 발송
      const prevRound = await getRoundByNumber(currentRound.roundNumber - 1);

      if (!prevRound) {
        logger.info('📊 [회차 리포트] 이전 회차 없음, 건너뜀');
        return {
          timestamp: startTime,
          roundNumber: 0,
          reportSent: false,
          newRoundStarted: false,
          newRoundNumber: null,
          errors: ['이전 회차 없음'],
        };
      }

      // grace period 체크 (수동 트리거 시 건너뜀)
      if (!force && !isGracePeriodEnded(prevRound)) {
        logger.info(`📊 [회차 리포트] ${prevRound.roundNumber}회차 지각 기간 미종료, 건너뜀`);
        return {
          timestamp: startTime,
          roundNumber: prevRound.roundNumber,
          reportSent: false,
          newRoundStarted: false,
          newRoundNumber: null,
          errors: ['지각 기간 미종료'],
        };
      }

      logger.info(`📊 [회차 리포트] ${prevRound.roundNumber}회차 리포트 생성 중...`);

      const reportData = await buildRoundReportDataForRound(prevRound);
      const notificationService = getNotificationService();
      const sent = await notificationService.sendRoundReport(reportData);

      if (!sent) {
        errors.push('리포트 발송 실패');
      }

      logger.info(`📊 [회차 리포트] ${prevRound.roundNumber}회차 리포트 ${sent ? '발송 완료 ✅' : '발송 실패 ❌'}`);

      return {
        timestamp: startTime,
        roundNumber: prevRound.roundNumber,
        reportSent: sent,
        newRoundStarted: false,
        newRoundNumber: null,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`📊 [회차 리포트] 에러: ${errorMsg}`);
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
   * 회차 시작 알림 발송
   * @param force - true면 날짜 체크 건너뜀 (수동 트리거용)
   */
  async sendRoundStartAnnouncement(force = false): Promise<RoundReportResult> {
    if (this.isRunning) {
      logger.info('🚀 [회차 시작] 이미 실행 중, 건너뜀');
      return {
        timestamp: new Date(),
        roundNumber: 0,
        reportSent: false,
        newRoundStarted: false,
        newRoundNumber: null,
        errors: ['이미 실행 중'],
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    const errors: string[] = [];

    try {
      const currentRound = await getCurrentRound();
      const todayStr = formatKSTDate(new Date());
      const isTodayRoundStart = todayStr === currentRound.startDate;

      // attendance-init(00:02)에서 이미 회차 전환 완료 — 현재 회차 기준으로 알림만 발송
      if (force || isTodayRoundStart) {
        logger.info(`🚀 [회차 시작] ${currentRound.roundNumber}회차 시작 알림 발송 중...`);

        const notificationService = getNotificationService();
        const sent = await notificationService.sendRoundStartAnnouncement(currentRound);

        if (!sent) {
          errors.push('회차 시작 알림 발송 실패');
        }

        logger.info(`🚀 [회차 시작] ${currentRound.roundNumber}회차 ${sent ? '발송 완료 ✅' : '발송 실패 ❌'}`);

        return {
          timestamp: startTime,
          roundNumber: currentRound.roundNumber,
          reportSent: false,
          newRoundStarted: sent,
          newRoundNumber: currentRound.roundNumber,
          errors,
        };
      }

      logger.info(`🚀 [회차 시작] 오늘(${todayStr})은 회차 시작일이 아님, 건너뜀`);

      return {
        timestamp: startTime,
        roundNumber: currentRound.roundNumber,
        reportSent: false,
        newRoundStarted: false,
        newRoundNumber: null,
        errors: ['오늘은 회차 시작일이 아님'],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`🚀 [회차 시작] 에러: ${errorMsg}`);
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
}

// Singleton instance
let roundReporterInstance: RoundReporter | null = null;

export function getRoundReporter(): RoundReporter {
  if (!roundReporterInstance) {
    roundReporterInstance = new RoundReporter();
  }
  return roundReporterInstance;
}

export function resetRoundReporter(): void {
  roundReporterInstance = null;
}
