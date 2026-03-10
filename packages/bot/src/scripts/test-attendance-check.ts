// eslint-disable-file
/**
 * 출석 체크 수동 테스트 스크립트
 *
 * 사용법:
 *   pnpm --filter @blog-study/bot test-attendance-check
 *
 * 전제 조건:
 *   1. Discord 봇이 실행 중이어야 함
 *   2. 현재 회차가 설정되어 있어야 함
 *   3. active 상태의 멤버가 있어야 함
 *
 * 테스트 내용:
 *   - 현재 회차의 모든 멤버 출석 상태 확인
 *   - 지각/결석 판정 로직 테스트
 *   - 유예 기간 종료 처리 테스트
 *   - 출석 통계 출력
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { getAttendanceChecker } from '../schedulers/attendance-checker';
import { getAttendanceService } from '../services/attendance.service';
import { getCurrentRound } from '../services/round.service';
import { loadBotEnv } from '@blog-study/shared';
import { getDb, members, rounds, attendance } from '@blog-study/shared/db';
import { eq, and, count } from 'drizzle-orm';

async function main() {
  console.log('🧪 출석 체크 수동 테스트 시작...\n');

  // 환경 변수 로드
  loadBotEnv();

  // Discord 클라이언트 생성
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  try {
    // Discord 봇 로그인
    console.log('📡 Discord 봇 로그인 중...');
    await client.login(process.env.DISCORD_TOKEN!);
    console.log('✅ Discord 봇 로그인 성공\n');

    // 1. 현재 회차 확인
    console.log('--- Step 1: 현재 회차 확인 ---');
    const currentRound = await getCurrentRound();
    console.log(`📅 현재 회차: ${currentRound.roundNumber}회차`);
    console.log(`   시작일: ${currentRound.startDate}`);
    console.log(`   종료일: ${currentRound.endDate}`);
    console.log(`   유예종료일: ${currentRound.graceEndDate}\n`);

    // 2. 회차 날짜 계산
    const roundStartDate = new Date(currentRound.startDate + 'T00:00:00.000Z');
    const roundEndDate = new Date(currentRound.endDate + 'T23:59:59.999Z');
    const roundGraceEndDate = new Date(currentRound.graceEndDate + 'T23:59:59.999Z');

    const now = new Date();
    const isBeforeEnd = now <= roundEndDate;
    const isGracePeriod = now > roundEndDate && now <= roundGraceEndDate;
    const isAfterGrace = now > roundGraceEndDate;

    console.log('--- Step 2: 현재 날짜 상태 ---');
    console.log(`   현재 시간 (KST): ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`   정기 마감 전: ${isBeforeEnd ? '✅' : '❌'}`);
    console.log(`   유예 기간 중: ${isGracePeriod ? '✅' : '❌'}`);
    console.log(`   유예 기간 종료: ${isAfterGrace ? '✅' : '❌'}\n`);

    // 3. 출석 체커 인스턴스 가져오기
    const attendanceChecker = getAttendanceChecker();

    // 4. 현재 출석 현황 조회
    console.log('--- Step 3: 현재 출석 현황 ---');
    const db = getDb();

    const statusCounts = await db
      .select({
        status: attendance.status,
        count: count(),
      })
      .from(attendance)
      .where(eq(attendance.roundId, currentRound.id))
      .groupBy(attendance.status);

    const statusMap = Object.fromEntries(statusCounts.map(s => [s.status, s.count]));

    console.log(`   전체 멤버 수: ${statusMap.PENDING || 0 + statusMap.SUBMITTED || 0 + statusMap.LATE || 0 + statusMap.ABSENT || 0}`);
    console.log(`   ⏳ 대기중 (PENDING): ${statusMap.PENDING || 0}명`);
    console.log(`   ✅ 제출완료 (SUBMITTED): ${statusMap.SUBMITTED || 0}명`);
    console.log(`   ⚠️  지각 (LATE): ${statusMap.LATE || 0}명`);
    console.log(`   ❌ 결석 (ABSENT): ${statusMap.ABSENT || 0}명\n`);

    // 5. 상태별 멤버 목록 출력
    console.log('--- Step 4: 상태별 멤버 목록 ---');

    const attendanceRecords = await db
      .select({
        member: members,
        attendanceStatus: attendance.status,
      })
      .from(attendance)
      .innerJoin(members, eq(attendance.memberId, members.id))
      .where(eq(attendance.roundId, currentRound.id))
      .orderBy(members.name);

    const pendingMembers = attendanceRecords.filter(r => r.attendanceStatus === 'PENDING');
    const submittedMembers = attendanceRecords.filter(r => r.attendanceStatus === 'SUBMITTED');
    const lateMembers = attendanceRecords.filter(r => r.attendanceStatus === 'LATE');
    const absentMembers = attendanceRecords.filter(r => r.attendanceStatus === 'ABSENT');

    if (pendingMembers.length > 0) {
      console.log(`\n   ⏳ 대기중 (${pendingMembers.length}명):`);
      pendingMembers.forEach(r => {
        console.log(`      - ${r.member.name} (@${r.member.discordUsername || 'N/A'})`);
      });
    }

    if (submittedMembers.length > 0) {
      console.log(`\n   ✅ 제출완료 (${submittedMembers.length}명):`);
      submittedMembers.forEach(r => {
        console.log(`      - ${r.member.name} (@${r.member.discordUsername || 'N/A'})`);
      });
    }

    if (lateMembers.length > 0) {
      console.log(`\n   ⚠️  지각 (${lateMembers.length}명):`);
      lateMembers.forEach(r => {
        console.log(`      - ${r.member.name} (@${r.member.discordUsername || 'N/A'})`);
      });
    }

    if (absentMembers.length > 0) {
      console.log(`\n   ❌ 결석 (${absentMembers.length}명):`);
      absentMembers.forEach(r => {
        console.log(`      - ${r.member.name} (@${r.member.discordUsername || 'N/A'})`);
      });
    }

    console.log('');

    // 6. 출석 체크 실행 (유예 기간 종료 시에만)
    if (isAfterGrace) {
      console.log('--- Step 5: 출석 체크 실행 (유예 기간 종료) ---');
      const checkResult = await attendanceChecker.check();

      console.log(`\n📋 체크 결과:`);
      console.log(`   처리된 멤버: ${checkResult.processedMembers}명`);
      console.log(`   결석으로 변경: ${checkResult.markedAbsent}명`);

      if (checkResult.errors.length > 0) {
        console.log(`\n❌ 에러:`);
        checkResult.errors.forEach(err => console.log(`   - ${err}`));
      }

      console.log('\n✅ 출석 체크 완료!');
    } else if (isGracePeriod) {
      console.log('--- Step 5: 유예 기간 중 ---');
      console.log('   아직 유예 기간이므로 결석 판정을 진행하지 않습니다.');
      console.log('   정기 마감일: ' + roundEndDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
      console.log('   유예 종료일: ' + roundGraceEndDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
      console.log('\n⏳ 유예 기간 종료 대기 중...');
    } else {
      console.log('--- Step 5: 정기 진행 중 ---');
      console.log('   아직 정기 기간이므로 출석 체크를 진행하지 않습니다.');
      console.log('   정기 종료일: ' + roundEndDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
      console.log('\n⏳ 정기 마감일 대기 중...');
    }

    // 7. 최종 요약
    console.log('\n--- 최종 요약 ---');
    console.log(`📅 ${currentRound.roundNumber}회차 출석 현황`);
    console.log(`   제출률: ${((statusMap.SUBMITTED || 0) / Math.max(1, statusMap.PENDING || 0 + statusMap.SUBMITTED || 0 + statusMap.LATE || 0 + statusMap.ABSENT || 0) * 100).toFixed(1)}%`);
    console.log(`   지각률: ${((statusMap.LATE || 0) / Math.max(1, statusMap.PENDING || 0 + statusMap.SUBMITTED || 0 + statusMap.LATE || 0 + statusMap.ABSENT || 0) * 100).toFixed(1)}%`);
    console.log(`   결석률: ${((statusMap.ABSENT || 0) / Math.max(1, statusMap.PENDING || 0 + statusMap.SUBMITTED || 0 + statusMap.LATE || 0 + statusMap.ABSENT || 0) * 100).toFixed(1)}%`);

    console.log('\n✅ 테스트 완료!');
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  } finally {
    // Discord 클라이언트 종료
    await client.destroy();
    console.log('\n👋 Discord 봇 종료');
  }
}

main();
