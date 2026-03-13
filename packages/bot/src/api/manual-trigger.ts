/**
 * Manual Trigger API
 * Functions to manually trigger bot scheduler operations
 */

import {
  getRssPoller,
  getAttendanceChecker,
  getFineReminder,
  getRoundReporter,
  getCurationCrawler,
  getWeeklyRanking,
} from '../schedulers';
import type {
  PollingCycleResult,
  AttendanceCheckResult,
  FineReminderResult,
  RoundReportResult,
  CurationCycleResult,
} from '../schedulers';
import type { WeeklyRankingResult } from '../schedulers/weekly-ranking';
import type { CurationShareResult } from '../schedulers/curation-crawler';
import { OperationErrorCode } from './types';

/**
 * Trigger RSS polling for all active members
 * @throws {Error} If RSS polling is already in progress
 */
export async function triggerRssPoll(): Promise<PollingCycleResult> {
  const rssPoller = getRssPoller();

  if (rssPoller.isPolling()) {
    const error = new Error('RSS 폴링이 이미 실행 중입니다');
    (error as any).code = OperationErrorCode.ALREADY_RUNNING;
    throw error;
  }

  return rssPoller.poll();
}

/**
 * Trigger attendance check for the current round
 * @throws {Error} If attendance check is already in progress or grace period not ended
 */
export async function triggerAttendanceCheck(): Promise<AttendanceCheckResult> {
  const attendanceChecker = getAttendanceChecker();

  if (attendanceChecker.isChecking()) {
    const error = new Error('출석 체크가 이미 실행 중입니다');
    (error as any).code = OperationErrorCode.ALREADY_RUNNING;
    throw error;
  }

  return attendanceChecker.check();
}

/**
 * Trigger attendance check for a specific round
 * @param roundId - Round ID to check
 */
export async function triggerAttendanceCheckForRound(
  roundId: number
): Promise<AttendanceCheckResult> {
  const attendanceChecker = getAttendanceChecker();

  return attendanceChecker.checkRound(roundId);
}

/**
 * Trigger fine reminders for all unpaid fines
 * @throws {Error} If fine reminder is already in progress
 */
export async function triggerFineReminder(): Promise<FineReminderResult> {
  const fineReminder = getFineReminder();

  if (fineReminder.isReminding()) {
    const error = new Error('벌금 알림이 이미 실행 중입니다');
    (error as any).code = OperationErrorCode.ALREADY_RUNNING;
    throw error;
  }

  return fineReminder.sendReminders();
}

/**
 * Trigger fine reminders for all unpaid fines (bypass 3-day check)
 * @throws {Error} If Discord client is not set
 */
export async function triggerFineReminderAll(): Promise<FineReminderResult> {
  const fineReminder = getFineReminder();

  return fineReminder.sendAllReminders();
}

/**
 * Trigger round report for the current round
 * @throws {Error} If round report is already in progress
 */
export async function triggerRoundReport(): Promise<RoundReportResult> {
  const roundReporter = getRoundReporter();

  if (roundReporter.isReporting()) {
    const error = new Error('회차 리포트가 이미 실행 중입니다');
    (error as any).code = OperationErrorCode.ALREADY_RUNNING;
    throw error;
  }

  return roundReporter.sendRoundReport();
}

/**
 * Trigger round report for a specific round
 * @param roundNumber - Round number to report
 */
export async function triggerRoundReportForRound(
  roundNumber: number
): Promise<RoundReportResult> {
  const roundReporter = getRoundReporter();

  return roundReporter.sendReportForRound(roundNumber);
}

/**
 * Trigger round start announcement for the current round
 */
export async function triggerRoundStart(): Promise<RoundReportResult> {
  const roundReporter = getRoundReporter();

  return roundReporter.sendRoundStartAnnouncement();
}

/**
 * Trigger curation crawling for all active sources
 * @throws {Error} If curation crawling is already in progress
 */
export async function triggerCurationCrawl(): Promise<CurationCycleResult> {
  const curationCrawler = getCurationCrawler();

  if (curationCrawler.isCrawlingNow()) {
    const error = new Error('큐레이션 크롤링이 이미 실행 중입니다');
    (error as any).code = OperationErrorCode.ALREADY_RUNNING;
    throw error;
  }

  return curationCrawler.crawl();
}

/**
 * Trigger curation content sharing
 * @throws {Error} If curation sharing is already in progress
 */
export async function triggerCurationShare(): Promise<CurationShareResult> {
  const curationCrawler = getCurationCrawler();

  if (curationCrawler.isSharingNow()) {
    const error = new Error('큐레이션 공유가 이미 실행 중입니다');
    (error as any).code = OperationErrorCode.ALREADY_RUNNING;
    throw error;
  }

  return curationCrawler.shareDailyContent();
}

/**
 * Trigger weekly ranking report
 * @throws {Error} If weekly ranking is already sending
 */
export async function triggerWeeklyRanking(): Promise<WeeklyRankingResult> {
  const weeklyRanking = getWeeklyRanking();

  if (weeklyRanking.isSending()) {
    const error = new Error('주간 랭킹이 이미 실행 중입니다');
    (error as any).code = OperationErrorCode.ALREADY_RUNNING;
    throw error;
  }

  return weeklyRanking.sendWeeklyRanking();
}

/**
 * Get operation status for all operations
 * Returns a map of operation IDs to their current status
 */
export async function getOperationStatus(): Promise<{
  'rss-poll': boolean;
  'attendance-check': boolean;
  'fine-reminder': boolean;
  'round-report': boolean;
  'round-start': boolean;
  'curation-crawl': boolean;
  'curation-share': boolean;
  'weekly-ranking': boolean;
}> {
  const rssPoller = getRssPoller();
  const attendanceChecker = getAttendanceChecker();
  const fineReminder = getFineReminder();
  const roundReporter = getRoundReporter();
  const curationCrawler = getCurationCrawler();
  const weeklyRanking = getWeeklyRanking();

  return {
    'rss-poll': rssPoller.isPolling(),
    'attendance-check': attendanceChecker.isChecking(),
    'fine-reminder': fineReminder.isReminding(),
    'round-report': roundReporter.isReporting(),
    'round-start': false, // Round start doesn't have a running lock
    'curation-crawl': curationCrawler.isCrawlingNow(),
    'curation-share': curationCrawler.isSharingNow(),
    'weekly-ranking': weeklyRanking.isSending(),
  };
}

/**
 * Operation metadata for displaying in the admin UI
 */
export const OPERATION_INFO = {
  'rss-poll': {
    id: 'rss-poll',
    name: 'RSS 폴링',
    description: '5분마다 모든 활성 멤버의 RSS 피드를 확인하여 새 게시글을 수집합니다',
    category: 'polling' as const,
    schedule: '5분마다',
  },
  'attendance-check': {
    id: 'attendance-check',
    name: '출석 체크',
    description: '매주 화요일 00:00에 유예 기간이 끝난 미체출 멤버를 결석으로 표시합니다',
    category: 'attendance' as const,
    schedule: '화요일 00:00',
  },
  'fine-reminder': {
    id: 'fine-reminder',
    name: '벌금 알림',
    description: '미납 벌금이 있는 멤버에게 3일마다 리마인드 DM을 발송합니다',
    category: 'fine' as const,
    schedule: '매일 10:00',
  },
  'round-report': {
    id: 'round-report',
    name: '회차 리포트',
    description: '회차 종료 시 전체 멤버의 출석 현황과 MVP를 포함한 리포트를 발송합니다',
    category: 'round' as const,
    schedule: '화요일 00:05',
  },
  'round-start': {
    id: 'round-start',
    name: '회차 시작 알림',
    description: '새로운 회차가 시작될 때 알림을 발송하고 회차를 전환합니다',
    category: 'round' as const,
    schedule: '월요일 00:00',
  },
  'curation-crawl': {
    id: 'curation-crawl',
    name: '큐레이션 크롤링',
    description: '외부 소스(VELO PORT, conf.tube 등)에서 기술 컨텐츠를 크롤링합니다',
    category: 'curation' as const,
    schedule: '매일 23:00',
  },
  'curation-share': {
    id: 'curation-share',
    name: '큐레이션 공유',
    description: '크롤링한 컨텐츠 중 하나를 선택하여 디스코드 채널에 공유합니다',
    category: 'curation' as const,
    schedule: '매일 10:00',
  },
  'weekly-ranking': {
    id: 'weekly-ranking',
    name: '주간 랭킹',
    description: '매주 일요일 22:00에 전체 멤버의 활동 점수 랭킹을 발송합니다',
    category: 'ranking' as const,
    schedule: '일요일 22:00',
  },
} as const;

export type OperationId = keyof typeof OPERATION_INFO;
