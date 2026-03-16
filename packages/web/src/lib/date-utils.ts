/**
 * 날짜 포맷팅 유틸리티 함수
 */

/**
 * 투표용 날짜 포맷팅 (YYYY-MM-DD → MM/DD (요일))
 * @param dateStr - ISO 날짜 문자열 (YYYY-MM-DD)
 * @returns 포맷된 날짜 문자열 (예: "03/17 (화)")
 */
export function formatPollDate(dateStr: string): string {
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[date.getDay()];
    return `${dateMatch[2]}/${dateMatch[3]} (${dayOfWeek})`;
  }
  return dateStr;
}

/**
 * 투표 마감시간 포맷팅
 * @param dateStr - ISO 날짜 문자열
 * @returns 포맷된 시간 문자열 (예: "3시간 후 마감", "마감됨")
 */
export function formatExpiresAt(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) return '마감됨';
  if (diffHours < 1) return '1시간 이내 마감';
  if (diffHours < 24) return `${diffHours}시간 후 마감`;
  if (diffDays < 7) return `${diffDays}일 후 마감`;
  return date.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
