/**
 * 날짜 유틸리티
 * 회차 날짜 계산, 마감일 계산, 지각/결석 판정
 * Requirements: 5.1, 5.4, 5.5, 5.6
 */

/**
 * 회차 정보 인터페이스
 */
export interface RoundDates {
  roundNumber: number;
  startDate: Date;      // 월요일 00:00
  endDate: Date;        // 일요일 23:59
  graceEndDate: Date;   // 월요일 23:59 (지각 마감)
}

/**
 * 출석 상태
 */
export type AttendanceStatus = 'pending' | 'submitted' | 'late' | 'absent';

/**
 * 밀리초 상수
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const ROUND_DURATION_WEEKS = 2;

/**
 * 날짜를 해당 일의 시작(00:00:00.000)으로 설정
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * 날짜를 해당 일의 끝(23:59:59.999)으로 설정
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * 주어진 날짜가 월요일인지 확인
 * @param date 확인할 날짜
 * @returns 월요일이면 true
 */
export function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

/**
 * 주어진 날짜가 일요일인지 확인
 * @param date 확인할 날짜
 * @returns 일요일이면 true
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * 주어진 날짜에서 가장 가까운 이전 월요일을 찾음
 * (해당 날짜가 월요일이면 그 날짜 반환)
 */
export function getPreviousMonday(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  // 일요일(0)은 6일 전, 월요일(1)은 0일 전, 화요일(2)은 1일 전...
  const daysToSubtract = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - daysToSubtract);
  return startOfDay(result);
}

/**
 * 스터디 시작일로부터 특정 회차의 날짜 정보 계산
 * 각 회차는 2주 (월요일 시작 ~ 다음주 일요일 마감)
 * 
 * @param studyStartDate 스터디 시작일 (월요일이어야 함)
 * @param roundNumber 회차 번호 (1부터 시작)
 * @returns 회차 날짜 정보
 */
export function calculateRoundDates(studyStartDate: Date, roundNumber: number): RoundDates {
  if (roundNumber < 1) {
    throw new Error('회차 번호는 1 이상이어야 합니다.');
  }

  // 시작일을 월요일 00:00으로 정규화
  const normalizedStart = getPreviousMonday(studyStartDate);
  
  // 회차 시작일 계산: (roundNumber - 1) * 2주
  const roundStartMs = normalizedStart.getTime() + (roundNumber - 1) * ROUND_DURATION_WEEKS * MS_PER_WEEK;
  const startDate = new Date(roundStartMs);
  
  // 회차 종료일: 시작일 + 13일 (2주차 일요일)
  const endDate = new Date(roundStartMs + 13 * MS_PER_DAY);
  endDate.setHours(23, 59, 59, 999);
  
  // 지각 마감일: 종료일 다음날 (월요일) 23:59
  const graceEndDate = new Date(roundStartMs + 14 * MS_PER_DAY);
  graceEndDate.setHours(23, 59, 59, 999);

  return {
    roundNumber,
    startDate: startOfDay(startDate),
    endDate,
    graceEndDate,
  };
}

/**
 * 주어진 날짜가 속한 회차 번호 계산
 * 
 * @param studyStartDate 스터디 시작일
 * @param targetDate 확인할 날짜
 * @returns 회차 번호 (스터디 시작 전이면 0)
 */
export function getRoundNumberByDate(studyStartDate: Date, targetDate: Date): number {
  const normalizedStart = getPreviousMonday(studyStartDate);
  const targetMs = targetDate.getTime();
  const startMs = normalizedStart.getTime();
  
  if (targetMs < startMs) {
    return 0; // 스터디 시작 전
  }
  
  const daysDiff = Math.floor((targetMs - startMs) / MS_PER_DAY);
  const roundNumber = Math.floor(daysDiff / (ROUND_DURATION_WEEKS * 7)) + 1;
  
  return roundNumber;
}

/**
 * 현재 회차가 마감되었는지 확인 (일요일 23:59 이후)
 */
export function isDeadlinePassed(roundDates: RoundDates, currentDate: Date = new Date()): boolean {
  return currentDate.getTime() > roundDates.endDate.getTime();
}

/**
 * 현재가 지각 기간인지 확인 (마감 후 ~ 지각 마감 전)
 */
export function isGracePeriod(roundDates: RoundDates, currentDate: Date = new Date()): boolean {
  const currentMs = currentDate.getTime();
  return currentMs > roundDates.endDate.getTime() && currentMs <= roundDates.graceEndDate.getTime();
}

/**
 * 지각 기간이 종료되었는지 확인 (월요일 23:59 이후)
 */
export function isGracePeriodEnded(roundDates: RoundDates, currentDate: Date = new Date()): boolean {
  return currentDate.getTime() > roundDates.graceEndDate.getTime();
}

/**
 * 포스트 제출 시점에 따른 출석 상태 결정
 * 
 * @param roundDates 회차 날짜 정보
 * @param submissionDate 제출 시점
 * @returns 출석 상태
 */
export function determineAttendanceStatus(
  roundDates: RoundDates,
  submissionDate: Date | null
): AttendanceStatus {
  if (!submissionDate) {
    return 'pending';
  }

  const submissionMs = submissionDate.getTime();
  
  // 회차 기간 내 제출 → 출석
  if (submissionMs <= roundDates.endDate.getTime()) {
    return 'submitted';
  }
  
  // 지각 기간 내 제출 → 지각
  if (submissionMs <= roundDates.graceEndDate.getTime()) {
    return 'late';
  }
  
  // 지각 기간 이후 → 결석 (이미 지난 회차에 대한 제출)
  return 'absent';
}

/**
 * 마감까지 남은 일수 계산
 */
export function getDaysUntilDeadline(roundDates: RoundDates, currentDate: Date = new Date()): number {
  const diffMs = roundDates.endDate.getTime() - currentDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.ceil(diffMs / MS_PER_DAY);
}

/**
 * 지각 마감까지 남은 일수 계산
 */
export function getDaysUntilGraceEnd(roundDates: RoundDates, currentDate: Date = new Date()): number {
  const diffMs = roundDates.graceEndDate.getTime() - currentDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.ceil(diffMs / MS_PER_DAY);
}

/**
 * 총 회차 수에 따른 모든 회차 날짜 생성
 */
export function generateAllRoundDates(studyStartDate: Date, totalRounds: number): RoundDates[] {
  const rounds: RoundDates[] = [];
  for (let i = 1; i <= totalRounds; i++) {
    rounds.push(calculateRoundDates(studyStartDate, i));
  }
  return rounds;
}

/**
 * 회차 기간이 정확히 2주(14일)인지 검증
 */
export function validateRoundDuration(roundDates: RoundDates): boolean {
  const startMs = roundDates.startDate.getTime();
  const endMs = roundDates.endDate.getTime();
  
  // 시작일부터 종료일까지 13일 (0~13일, 총 14일)
  // endDate는 23:59:59.999이므로 약 13.999일이 됨, floor 사용
  const durationDays = Math.floor((endMs - startMs) / MS_PER_DAY);
  return durationDays === 13; // 0일차(월) ~ 13일차(일) = 14일
}

/**
 * 회차 시작일이 월요일인지 검증
 */
export function validateRoundStartsOnMonday(roundDates: RoundDates): boolean {
  return isMonday(roundDates.startDate);
}

/**
 * 회차 종료일이 일요일인지 검증
 */
export function validateRoundEndsOnSunday(roundDates: RoundDates): boolean {
  return isSunday(roundDates.endDate);
}
