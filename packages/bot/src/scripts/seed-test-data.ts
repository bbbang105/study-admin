/**
 * 테스트용 더미 데이터 생성 스크립트
 *
 * 사용법:
 *   pnpm --filter @blog-study/bot seed-test-data
 *
 * 생성되는 데이터:
 *   - 테스트 회차 (rounds)
 *   - 테스트 멤버 (members)
 *   - 출석 기록 (attendance)
 *   - 포스트 (posts)
 *   - 벌금 (fines)
 *   - 활동 점수 (activity_scores)
 */

import { loadBotEnv } from '@blog-study/shared';
import { getDb, members, rounds, attendance, posts, fines, activityScores, ActivityScoreType } from '@blog-study/shared/db';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🌱 테스트 데이터 생성 시작...\n');

  // 환경 변수 로드
  loadBotEnv();

  const db = getDb();

  try {
    // 1. 기존 테스트 데이터 확인
    console.log('--- Step 1: 기존 테스트 데이터 확인 ---');
    const [existingTestRound] = await db
      .select()
      .from(rounds)
      .where(eq(rounds.roundNumber, 999))
      .limit(1);

    if (existingTestRound) {
      console.log('   테스트 회차가 이미 존재합니다. (999회차)');
      const deleteConfirm = await prompt('   기존 테스트 데이터를 삭제하고 다시 생성하시겠습니까? (y/N): ');

      if (deleteConfirm.toLowerCase() === 'y') {
        console.log('   기존 테스트 데이터 삭제 중...');
        // foreign key 순서대로 삭제
        await db.delete(attendance).where(eq(attendance.roundId, existingTestRound.id));
        await db.delete(posts).where(eq(posts.roundId, existingTestRound.id));
        await db.delete(fines).where(eq(fines.roundId, existingTestRound.id));
        await db.delete(rounds).where(eq(rounds.id, existingTestRound.id));
        console.log('   ✅ 기존 테스트 데이터 삭제 완료\n');
      } else {
        console.log('   테스트 데이터 생성을 취소합니다.');
        return;
      }
    }

    // 2. 테스트 회차 생성
    console.log('--- Step 2: 테스트 회차 생성 ---');

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7); // 7일 전 시작

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7); // 7일 후 종료

    const graceEndDate = new Date(endDate);
    graceEndDate.setDate(graceEndDate.getDate() + 3); // 유예기간 3일

    const [newRound] = await db
      .insert(rounds)
      .values({
        roundNumber: 999,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        graceEndDate: graceEndDate.toISOString().split('T')[0],
        isCurrent: true,
      })
      .returning();

    console.log(`   ✅ 999회차 생성`);
    console.log(`      시작일: ${startDate.toISOString().split('T')[0]}`);
    console.log(`      종료일: ${endDate.toISOString().split('T')[0]}`);
    console.log(`      유예종료일: ${graceEndDate.toISOString().split('T')[0]}\n`);

    // 3. 테스트 멤버 생성 (또는 기존 멤버 사용)
    console.log('--- Step 3: 테스트 멤버 확인 ---');

    const testMembers = [
      { name: '황동준', nickname: '동준이', discordUsername: 'hwangdongjun', discordId: '111111111111111111', part: 'frontend' },
      { name: '테스터2', nickname: '투스', discordUsername: 'tester2', discordId: '222222222222222222', part: 'backend' },
      { name: '테스터3', nickname: '쓰리스', discordUsername: 'tester3', discordId: '333333333333333333', part: 'devops' },
      { name: '테스터4', nickname: '포스', discordUsername: 'tester4', discordId: '444444444444444444', part: 'design' },
      { name: '테스터5', nickname: '파이브', discordUsername: 'tester5', discordId: '555555555555555555', part: 'frontend' },
    ];

    const memberIds: string[] = [];

    for (const testMember of testMembers) {
      // 기존 멤버 확인
      const [existing] = await db
        .select()
        .from(members)
        .where(eq(members.discordId, testMember.discordId))
        .limit(1);

      if (existing) {
        memberIds.push(existing.id);
        console.log(`   ✅ 기존 멤버: ${testMember.name} (@${testMember.discordUsername})`);
      } else {
        // 신규 멤버 생성
        const [created] = await db
          .insert(members)
          .values({
            ...testMember,
            status: 'active',
            blogUrl: `https://${testMember.discordUsername}.blog.com`,
            rssUrl: `https://${testMember.discordUsername}.blog.com/rss`,
            rssConsent: true,
            onboardingCompleted: true,
            interests: ['React', 'TypeScript', 'Node.js'],
          })
          .returning();

        memberIds.push(created.id);
        console.log(`   ✅ 신규 멤버: ${testMember.name} (@${testMember.discordUsername})`);
      }
    }

    console.log(`   총 ${memberIds.length}명의 멤버\n`);

    // 4. 출석 기록 생성 (다양한 상태)
    console.log('--- Step 4: 출석 기록 생성 ---');

    const attendanceData = [
      { memberId: memberIds[0], status: 'LATE' },      // 황동준: 지각
      { memberId: memberIds[1], status: 'SUBMITTED' }, // 제출완료
      { memberId: memberIds[2], status: 'PENDING' },   // 대기중
      { memberId: memberIds[3], status: 'ABSENT' },    // 결석
      { memberId: memberIds[4], status: 'SUBMITTED' }, // 제출완료
    ];

    for (const data of attendanceData) {
      await db.insert(attendance).values({
        memberId: data.memberId,
        roundId: newRound.id,
        status: data.status as any,
      });
      console.log(`   ✅ ${data.status}: ${memberIds.indexOf(data.memberId) + 1}번 멤버`);
    }

    console.log('');

    // 5. 포스트 생성
    console.log('--- Step 5: 포스트 생성 ---');

    const postCounts = [3, 2, 0, 0, 4]; // 각 멤버별 포스트 수

    for (let i = 0; i < memberIds.length; i++) {
      const memberId = memberIds[i];
      const count = postCounts[i];

      for (let j = 0; j < count; j++) {
        const pubDate = new Date(startDate);
        pubDate.setDate(pubDate.getDate() + j * 2);

        await db.insert(posts).values({
          memberId,
          roundId: newRound.id,
          title: `${i + 1}번 멤버의 ${j + 1}번째 포스트`,
          url: `https://${testMembers[i].discordUsername}.blog.com/post-${j + 1}`,
          publishedAt: pubDate,
          description: `테스트 포스트 내용 ${j + 1}`,
        });
      }

      console.log(`   ✅ ${i + 1}번 멤버: ${count}개 포스트`);
    }

    console.log('');

    // 6. 벌금 생성
    console.log('--- Step 6: 벌금 생성 ---');

    // 황동준: 결석 대벌금 = 50,000원 (벌금 왕)
    await db.insert(fines).values({
      memberId: memberIds[0],
      roundId: newRound.id,
      type: 'absent',
      amount: 50000,
      status: 'PENDING',
    });
    console.log('   ✅ 황동준: 결석 대벌금 = 50,000원 (벌금 왕)');

    // 지각 벌금 (2번 멤버)
    await db.insert(fines).values({
      memberId: memberIds[1],
      roundId: newRound.id,
      type: 'late',
      amount: 3000,
      status: 'PENDING',
    });
    console.log('   ✅ 지각 벌금: 2번 멤버 (3,000원)');

    // 결석 벌금 (4번 멤버)
    await db.insert(fines).values({
      memberId: memberIds[3],
      roundId: newRound.id,
      type: 'absent',
      amount: 5000,
      status: 'PENDING',
    });
    console.log('   ✅ 결석 벌금: 4번 멤버 (5,000원)');

    // 납부완료 벌금 (3번 멤버)
    await db.insert(fines).values({
      memberId: memberIds[2],
      roundId: newRound.id,
      type: 'late',
      amount: 3000,
      status: 'PAID',
    });
    console.log('   ✅ 납부완료 벌금: 3번 멤버 (3,000원)');

    console.log('');

    // 7. 활동 점수 생성
    console.log('--- Step 7: 활동 점수 생성 ---');

    const scoreData = [
      { memberId: memberIds[0], points: 100 }, // 1번: 100점 (3개 포스트 + 활동)
      { memberId: memberIds[1], points: 70 },  // 2번: 70점 (2개 포스트 + 활동)
      { memberId: memberIds[2], points: 20 },  // 3번: 20점 (활동만)
      { memberId: memberIds[3], points: 10 },  // 4번: 10점 (활동만)
      { memberId: memberIds[4], points: 140 }, // 5번: 140점 (4개 포스트 + 활동)
    ];

    for (const data of scoreData) {
      await db.insert(activityScores).values({
        memberId: data.memberId,
        type: ActivityScoreType.BLOG_POST,
        points: data.points,
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD 형식
        description: '테스트 활동 점수',
      });
      console.log(`   ✅ ${scoreData.indexOf(data) + 1}번 멤버: ${data.points}점`);
    }

    console.log('');

    // 8. 요약
    console.log('--- 생성 완료 ---');
    console.log(`📊 999회차 테스트 데이터`);
    console.log(`   회차: ${newRound.roundNumber}회차`);
    console.log(`   멤버: ${memberIds.length}명`);
    console.log(`   포스트: ${postCounts.reduce((a, b) => a + b, 0)}개`);
    console.log(`   벌금: 3건 (미납 2건, 납부완료 1건)`);
    console.log(`   활동 점수: 부여 완료`);

    console.log('\n✅ 테스트 데이터 생성 완료!');
    console.log('\n이제 다음 명령어로 테스트를 실행하세요:');
    console.log('  pnpm --filter @blog-study/bot test-attendance');
    console.log('  pnpm --filter @blog-study/bot test-round-report');
    console.log('  pnpm --filter @blog-study/bot test-fine-reminder');

  } catch (error) {
    console.error('❌ 테스트 데이터 생성 실패:', error);
    process.exit(1);
  }
}

async function prompt(question: string): Promise<string> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

main();
