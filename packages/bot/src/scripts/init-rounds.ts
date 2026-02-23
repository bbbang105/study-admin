#!/usr/bin/env npx ts-node
/**
 * Round Initialization Script
 * 스터디 시작일과 총 회차 수로 rounds 테이블 생성
 * Requirements: 15.1, 15.2
 * 
 * Usage:
 *   npx ts-node src/scripts/init-rounds.ts --start-date 2024-01-08 --total-rounds 10
 *   npx ts-node src/scripts/init-rounds.ts -s 2024-01-08 -t 10
 *   npx ts-node src/scripts/init-rounds.ts --delete  # Delete all rounds
 *   npx ts-node src/scripts/init-rounds.ts --list    # List all rounds
 */

import 'dotenv/config';
import { closeDb } from '@blog-study/shared/db';
import {
  createRounds,
  deleteAllRounds,
  getAllRounds,
  RoundError,
  RoundErrorCodes,
} from '../services/round.service';
import { isMonday, getPreviousMonday } from '@blog-study/shared/utils';

interface ParsedArgs {
  startDate?: string;
  totalRounds?: number;
  delete?: boolean;
  list?: boolean;
  force?: boolean;
  help?: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-s':
      case '--start-date':
        result.startDate = args[++i];
        break;
      case '-t':
      case '--total-rounds': {
        const val = args[++i];
        if (val) {
          result.totalRounds = parseInt(val, 10);
        }
        break;
      }
      case '-d':
      case '--delete':
        result.delete = true;
        break;
      case '-l':
      case '--list':
        result.list = true;
        break;
      case '-f':
      case '--force':
        result.force = true;
        break;
      case '-h':
      case '--help':
        result.help = true;
        break;
    }
  }
  
  return result;
}

function printHelp(): void {
  console.log(`
회차 초기화 스크립트 (Round Initialization Script)

사용법:
  npx ts-node src/scripts/init-rounds.ts [옵션]

옵션:
  -s, --start-date <날짜>    스터디 시작일 (YYYY-MM-DD 형식, 월요일 권장)
  -t, --total-rounds <숫자>  총 회차 수 (1-52)
  -d, --delete               모든 회차 삭제
  -l, --list                 모든 회차 목록 출력
  -f, --force                기존 회차가 있어도 삭제 후 재생성
  -h, --help                 도움말 출력

예시:
  # 10회차 스터디 생성 (2024년 1월 8일 시작)
  npx ts-node src/scripts/init-rounds.ts -s 2024-01-08 -t 10

  # 기존 회차 삭제 후 재생성
  npx ts-node src/scripts/init-rounds.ts -s 2024-01-08 -t 10 --force

  # 모든 회차 목록 확인
  npx ts-node src/scripts/init-rounds.ts --list

  # 모든 회차 삭제
  npx ts-node src/scripts/init-rounds.ts --delete

참고:
  - 시작일이 월요일이 아닌 경우, 가장 가까운 이전 월요일로 조정됩니다.
  - 각 회차는 2주 (월요일 시작 ~ 다음주 일요일 마감)입니다.
  - 지각 마감은 마감일 다음날 월요일 23:59입니다.
`);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayIndex = date.getDay();
  return `${dateStr} (${days[dayIndex]})`;
}

async function listRounds(): Promise<void> {
  const roundsList = await getAllRounds();
  
  if (roundsList.length === 0) {
    console.log('생성된 회차가 없습니다.');
    return;
  }
  
  console.log('\n=== 회차 목록 ===\n');
  console.log('회차\t시작일\t\t\t종료일\t\t\t지각마감\t\t현재');
  console.log('─'.repeat(80));
  
  for (const round of roundsList) {
    const current = round.isCurrent ? '✓' : '';
    console.log(
      `${round.roundNumber}\t${formatDate(round.startDate)}\t${formatDate(round.endDate)}\t${formatDate(round.graceEndDate)}\t${current}`
    );
  }
  
  console.log(`\n총 ${roundsList.length}개 회차`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help) {
    printHelp();
    return;
  }
  
  try {
    // List rounds
    if (args.list) {
      await listRounds();
      return;
    }
    
    // Delete all rounds
    if (args.delete && !args.startDate) {
      console.log('모든 회차를 삭제합니다...');
      await deleteAllRounds();
      console.log('✓ 모든 회차가 삭제되었습니다.');
      return;
    }
    
    // Create rounds
    if (!args.startDate || !args.totalRounds) {
      console.error('오류: 시작일(-s)과 총 회차 수(-t)를 모두 지정해야 합니다.');
      console.log('도움말: npx ts-node src/scripts/init-rounds.ts --help');
      process.exit(1);
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.startDate)) {
      console.error('오류: 날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 사용하세요.');
      process.exit(1);
    }
    
    const startDate = new Date(args.startDate + 'T00:00:00.000Z');
    
    // Check if date is valid
    if (isNaN(startDate.getTime())) {
      console.error('오류: 유효하지 않은 날짜입니다.');
      process.exit(1);
    }
    
    // Warn if not Monday
    if (!isMonday(startDate)) {
      const adjustedDate = getPreviousMonday(startDate);
      const adjustedDateStr = adjustedDate.toISOString().split('T')[0];
      console.log(`⚠ 시작일이 월요일이 아닙니다. ${adjustedDateStr} (월)로 조정됩니다.`);
    }
    
    // Validate total rounds
    if (args.totalRounds < 1 || args.totalRounds > 52) {
      console.error('오류: 총 회차 수는 1~52 사이여야 합니다.');
      process.exit(1);
    }
    
    // Force delete if requested
    if (args.force) {
      console.log('기존 회차를 삭제합니다...');
      await deleteAllRounds();
    }
    
    console.log(`\n회차 생성 중...`);
    console.log(`  시작일: ${args.startDate}`);
    console.log(`  총 회차: ${args.totalRounds}회`);
    
    const createdRounds = await createRounds(startDate, args.totalRounds);
    
    console.log(`\n✓ ${createdRounds.length}개 회차가 생성되었습니다.\n`);
    
    // Show created rounds
    await listRounds();
    
  } catch (error) {
    if (error instanceof RoundError) {
      if (error.code === RoundErrorCodes.ROUNDS_ALREADY_EXIST) {
        console.error(`오류: ${error.userMessage}`);
        console.log('기존 회차를 삭제하려면 --force 옵션을 사용하세요.');
      } else {
        console.error(`오류: ${error.userMessage}`);
      }
    } else {
      console.error('오류:', error);
    }
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main().catch(console.error);
