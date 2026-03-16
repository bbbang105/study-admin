/**
 * 활동 점수 타입별 메타데이터 (Single Source of Truth)
 * 대시보드, 프로필, 관리자 페이지, API에서 공통 사용
 */

import { db as sharedDb } from '@blog-study/shared';

const { ActivityScoreType } = sharedDb;

export interface ScoreTypeMeta {
  type: string;
  label: string;
  emoji: string;
  points: number;
  dailyCap: number;
  badgeClass: string;
}

/** 점수 타입별 메타데이터 (순서 = UI 표시 순서) */
export const SCORE_TYPE_META: ScoreTypeMeta[] = [
  { type: ActivityScoreType.BLOG_POST, label: '블로그 포스트', emoji: '📝', points: 30, dailyCap: 60, badgeClass: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800' },
  { type: ActivityScoreType.BOARD_POST, label: '게시판 글', emoji: '✏️', points: 10, dailyCap: 20, badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' },
  { type: ActivityScoreType.POST_COMMENT, label: '포스트 댓글', emoji: '💬', points: 5, dailyCap: 20, badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
  { type: ActivityScoreType.BOARD_COMMENT, label: '게시판 댓글', emoji: '💭', points: 2, dailyCap: 10, badgeClass: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800' },
  { type: ActivityScoreType.POST_VIEW, label: '포스트 조회', emoji: '👀', points: 3, dailyCap: 15, badgeClass: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800' },
  { type: ActivityScoreType.ADMIN_MANUAL, label: '관리자 부여', emoji: '🎁', points: 0, dailyCap: Infinity, badgeClass: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800' },
];

/** 타입 → 메타데이터 맵 (빠른 조회용) */
export const SCORE_TYPE_MAP = new Map(SCORE_TYPE_META.map((m) => [m.type, m]));

/** 타입 → 라벨 */
export function getScoreTypeLabel(type: string): string {
  return SCORE_TYPE_MAP.get(type)?.label ?? type;
}

/** 타입 → emoji */
export function getScoreTypeEmoji(type: string): string {
  return SCORE_TYPE_MAP.get(type)?.emoji ?? '⭐';
}

/** 타입 → 뱃지 클래스 */
export function getScoreTypeBadgeClass(type: string): string {
  return SCORE_TYPE_MAP.get(type)?.badgeClass ?? 'bg-muted text-muted-foreground border-border';
}
