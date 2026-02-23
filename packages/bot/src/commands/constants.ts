/**
 * Shared constants and utilities for command handlers
 */

/**
 * Discord role name for study participants.
 * Used when assigning/removing the role on join and leave.
 */
export const STUDY_ROLE_NAME = '스터디원';

/**
 * Get rank emoji for top 3 positions; returns numbered string for the rest.
 */
export function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return `${rank}.`;
  }
}
