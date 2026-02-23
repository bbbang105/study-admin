// Admin Commands Registry
// 관리자 전용 명령어들을 등록합니다.
// Requirements: 3.8, 8.7 - 관리자 권한 체크 필요

import type { CommandHandler } from '../../bot';

// Admin commands
import { 휴면Command } from './dormant';
import { 휴면해제Command } from './dormant-release';
import { 벌금현황Command } from './fine-status';
import { 벌금전체Command } from './fine-all';
import { 벌금면제Command } from './fine-exempt';
import { 설정Command } from './settings';
import { 출석수정Command } from './attendance-edit';
import { 큐레이션소스Command } from './curation-source';

// Admin commands array - all commands here must have adminOnly: true
const adminCommands: CommandHandler[] = [
  휴면Command,        // /휴면 [유저] - Requirements 3.1, 3.2, 3.3, 3.8
  휴면해제Command,    // /휴면해제 [유저] - Requirements 3.6, 3.8
  벌금현황Command,    // /벌금현황 [유저] - Requirements 8.5, 8.7
  벌금전체Command,    // /벌금전체 - Requirements 8.6, 8.7
  벌금면제Command,    // /벌금면제 [유저] [회차] - Requirements 15.7
  설정Command,        // /설정 [항목] [값] - Requirements 15.1, 15.2, 15.3, 15.4
  출석수정Command,    // /출석수정 [유저] [회차] [상태] - Requirements 15.6
  큐레이션소스Command, // /큐레이션소스 [추가|삭제] [URL] - Requirements 15.5
];

/**
 * Get all admin commands
 * All commands returned here should have adminOnly: true
 */
export function getAdminCommands(): CommandHandler[] {
  return adminCommands;
}

/**
 * Validate that all admin commands have adminOnly flag set
 * This is a development-time check
 */
export function validateAdminCommands(): boolean {
  return adminCommands.every((cmd) => cmd.adminOnly === true);
}
