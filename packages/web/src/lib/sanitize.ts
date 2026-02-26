/**
 * 입력 새니타이즈 유틸리티
 */

/**
 * description 필드 새니타이즈
 * - 제어 문자 제거
 * - 제로 너비 / 방향 제어 유니코드 제거
 * - 양쪽 공백 제거, 최대 300자
 */
export function sanitizeDescription(input: string): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
    .trim()
    .slice(0, 300);
}

/**
 * KST (UTC+9) 기준 오늘 날짜 문자열 (YYYY-MM-DD)
 */
export function getTodayKST(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}
