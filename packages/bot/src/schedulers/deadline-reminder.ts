/**
 * Deadline Reminder Scheduler
 * 마감 D-2 / D-1 / D-day에 미제출 active 멤버에게 DM 발송
 */

import { Client } from 'discord.js';
import { and, eq } from 'drizzle-orm';
import { attendance, AttendanceStatus, getDb, members, MemberStatus } from '@blog-study/shared/db';
import { getCurrentRound } from '../services/round.service';
import logger, { serializeError } from '../lib/logger';
import { sendReminderPush } from '../lib/push-client';

export interface DeadlineReminderResult {
  timestamp: Date;
  dDay: number | null;
  targetCount: number;
  sentCount: number;
  failedCount: number;
}

interface ReminderMessage {
  title: string;
  body: string[];
}

/**
 * D-day별 메시지 구성
 */
function getDeadlineMessage(dDay: number, roundNumber: number, endDate: string): ReminderMessage {
  const formattedDate = formatKSTDate(endDate);

  switch (dDay) {
    case 2:
      return {
        title: '"📝 글 제출 마감이 이틀 남았어요"',
        body: [
          `${roundNumber}회차 마감일은 **${formattedDate}**이에요.`,
          ``,
          `아직 여유가 있지만, 미리 준비하면 마음이 편하겠죠?`,
          `주제가 안 떠오르면 최근에 배운 걸 짧게 정리하는 것도 좋아요 ✍️`,
        ],
      };
    case 1:
      return {
        title: '"⏳ 내일이 마감이에요!"',
        body: [
          `${roundNumber}회차 마감이 **내일 ${formattedDate}**이에요.`,
          ``,
          `완벽하지 않아도 괜찮아요.`,
          `짧은 글이라도 꾸준히 쓰는 게 중요하니까요 💪`,
        ],
      };
    case 0:
      return {
        title: '"🔥 오늘이 마감일이에요!"',
        body: [
          `${roundNumber}회차 마감이 **오늘**까지입니다.`,
          ``,
          `아직 시간이 있어요! 지금 시작해도 충분합니다.`,
          `오늘 안에 제출하면 정상 출석 처리돼요 ✅`,
        ],
      };
    default:
      return { title: '', body: [] };
  }
}

/**
 * YYYY-MM-DD → "M월 D일 (요일)" 형식
 */
function formatKSTDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export class DeadlineReminder {
  private isRunning = false;
  private client: Client | null = null;

  setClient(client: Client): void {
    this.client = client;
  }

  isSending(): boolean {
    return this.isRunning;
  }

  /**
   * 마감 D-2/D-1/D-day 확인 후 미제출 멤버에게 DM 발송
   */
  async sendReminders(): Promise<DeadlineReminderResult> {
    const emptyResult = (dDay: number | null = null): DeadlineReminderResult => ({
      timestamp: new Date(),
      dDay,
      targetCount: 0,
      sentCount: 0,
      failedCount: 0,
    });

    if (this.isRunning) {
      logger.info('📅 [마감 리마인더] 이미 실행 중, 건너뜀');
      return emptyResult();
    }

    if (!this.client) {
      logger.error('📅 [마감 리마인더] Discord 클라이언트 미설정');
      return emptyResult();
    }

    this.isRunning = true;

    try {
      const currentRound = await getCurrentRound().catch(() => null);
      if (!currentRound) {
        logger.info('📅 [마감 리마인더] 현재 회차 없음, 스킵');
        return emptyResult();
      }

      // endDate 기준 D-day 계산 (KST)
      const now = new Date();
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = kstNow.toISOString().split('T')[0]!;

      const endDate = new Date(`${currentRound.endDate}T00:00:00+09:00`);
      const today = new Date(`${todayStr}T00:00:00+09:00`);
      const diffDays = Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // D-2, D-1, D-0만 처리
      if (diffDays < 0 || diffDays > 2) {
        logger.info({ diffDays, endDate: currentRound.endDate }, '📅 [마감 리마인더] D-day 범위 밖, 스킵');
        return emptyResult(diffDays);
      }

      return this.sendForDDay(diffDays, currentRound);
    } catch (error) {
      logger.error({ error: serializeError(error) }, '📅 [마감 리마인더] 에러');
      return emptyResult();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 특정 D-day 메시지를 수동 발송 (관리자 대시보드용)
   */
  async sendManual(dDay: number): Promise<DeadlineReminderResult> {
    const emptyResult = (): DeadlineReminderResult => ({
      timestamp: new Date(),
      dDay,
      targetCount: 0,
      sentCount: 0,
      failedCount: 0,
    });

    if (this.isRunning) {
      logger.info('📅 [마감 리마인더] 이미 실행 중, 건너뜀');
      return emptyResult();
    }

    this.isRunning = true;

    if (!this.client) {
      this.isRunning = false;
      logger.error('📅 [마감 리마인더] Discord 클라이언트 미설정');
      return emptyResult();
    }

    if (dDay < 0 || dDay > 2) {
      this.isRunning = false;
      logger.info({ dDay }, '📅 [마감 리마인더] 유효하지 않은 D-day (0~2만 가능)');
      return emptyResult();
    }

    try {
      const currentRound = await getCurrentRound().catch(() => null);
      if (!currentRound) {
        logger.info('📅 [마감 리마인더] 현재 회차 없음, 스킵');
        return emptyResult();
      }

      return this.sendForDDay(dDay, currentRound);
    } catch (error) {
      logger.error({ error: serializeError(error) }, '📅 [마감 리마인더] 수동 발송 에러');
      return emptyResult();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 실제 푸시 발송 로직 (자동/수동 공용)
   */
  private async sendForDDay(
    dDay: number,
    currentRound: { id: number; roundNumber: number; endDate: string },
  ): Promise<DeadlineReminderResult> {
    const emptyResult = (): DeadlineReminderResult => ({
      timestamp: new Date(),
      dDay,
      targetCount: 0,
      sentCount: 0,
      failedCount: 0,
    });

    const message = getDeadlineMessage(dDay, currentRound.roundNumber, currentRound.endDate);
    if (!message.title) return emptyResult();

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

    if (pendingMembers.length === 0) {
      logger.info({ dDay }, '📅 [마감 리마인더] 미제출 멤버 없음');
      return emptyResult();
    }

    logger.info(
      { dDay, count: pendingMembers.length },
      `📅 [마감 리마인더] D-${dDay} 미제출 멤버 ${pendingMembers.length}명에게 푸시 발송`
    );

    const memberIds = pendingMembers.map((m) => m.id);
    const pushTitle = message.title.replace(/^"|"$/g, '');
    const pushBody = message.body.join(' ').slice(0, 200);

    const result = await sendReminderPush({
      type: 'deadline_reminder',
      memberIds,
      title: pushTitle,
      body: pushBody,
      clickUrl: '/dashboard',
    });

    return {
      timestamp: new Date(),
      dDay,
      targetCount: pendingMembers.length,
      sentCount: result.success,
      failedCount: result.failed,
    };
  }
}

// Singleton
let instance: DeadlineReminder | null = null;

export function getDeadlineReminder(): DeadlineReminder {
  if (!instance) {
    instance = new DeadlineReminder();
  }
  return instance;
}

export function resetDeadlineReminder(): void {
  instance = null;
}
