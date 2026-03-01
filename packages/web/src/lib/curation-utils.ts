/**
 * 큐레이션 UI 유틸리티
 */

const GRADIENTS = [
  'from-sky-100 to-sky-200 dark:from-sky-900/30 dark:to-sky-800/30',
  'from-violet-100 to-violet-200 dark:from-violet-900/30 dark:to-violet-800/30',
  'from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30',
  'from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30',
  'from-rose-100 to-rose-200 dark:from-rose-900/30 dark:to-rose-800/30',
  'from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/30',
] as const;

/**
 * 소스명/제목 기반 결정적 그라디언트 반환
 * 썸네일이 없을 때 플레이스홀더로 사용
 */
export function getArticleGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]!;
}

/**
 * 상대 시간 포맷 (한국어)
 */
export function formatRelativeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/**
 * 카테고리별 스타일 상수
 */
export const CATEGORY_STYLES: Record<string, { label: string; emoji: string; bg: string; text: string; ring: string }> = {
  conference: {
    label: '컨퍼런스',
    emoji: '🎤',
    bg: 'bg-violet-100 dark:bg-violet-500/20',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200 dark:ring-violet-500/30',
  },
  article: {
    label: '아티클',
    emoji: '📝',
    bg: 'bg-sky-100 dark:bg-sky-500/20',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200 dark:ring-sky-500/30',
  },
};
