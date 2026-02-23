// Command Registry
// 모든 슬래시 명령어를 등록하고 관리합니다.
// Requirements: 3.8, 8.7 - 관리자 권한 체크 지원

import type { CommandHandler } from '../bot';

// Import user commands
import { 핑Command } from './ping';
import { 탈퇴Command } from './leave';
import { 내정보Command } from './my-info';
import { 참가자목록Command } from './member-list';
import { 현황Command } from './status';
import { 랭킹Command } from './ranking';
import { 통계Command } from './stats';
import { 관심분야Command } from './interests';

// Import admin commands from admin directory
import { getAdminCommands as getAdminCommandsFromDir } from './admin';

// User commands array
const userCommands: CommandHandler[] = [
  핑Command,
  탈퇴Command,
  내정보Command,
  참가자목록Command,
  현황Command,
  랭킹Command,
  통계Command,
  관심분야Command,
];

/**
 * Get all registered commands (user + admin)
 */
export function getAllCommands(): CommandHandler[] {
  return [...userCommands, ...getAdminCommandsFromDir()];
}

/**
 * Get user commands only (non-admin)
 */
export function getUserCommands(): CommandHandler[] {
  return userCommands.filter((cmd) => !cmd.adminOnly);
}

/**
 * Get admin commands only
 */
export function getAdminCommands(): CommandHandler[] {
  return getAdminCommandsFromDir();
}

/**
 * Find a command by name
 */
export function findCommand(name: string): CommandHandler | undefined {
  return getAllCommands().find((cmd) => cmd.data.name === name);
}

/**
 * Check if a command exists
 */
export function hasCommand(name: string): boolean {
  return findCommand(name) !== undefined;
}

/**
 * Check if a command requires admin permissions
 */
export function isAdminCommand(name: string): boolean {
  const command = findCommand(name);
  return command?.adminOnly === true;
}
