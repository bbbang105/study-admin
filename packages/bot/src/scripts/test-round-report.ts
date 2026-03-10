/**
 * 회차 리포트 수동 테스트 스크립트
 *
 * 사용법:
 *   pnpm --filter @blog-study/bot test-round-report
 *
 * 전제 조건:
 *   1. Discord 봇이 실행 중이어야 함
 *   2. 현재 회차가 설정되어 있어야 함
 *   3. config 테이블에 NOTICE_CHANNEL이 설정되어 있어야 함
 *
 * 테스트 내용:
 *   - 현재 회차 정보 확인
 *   - 출석 통계 계산
 *   - 포스트 통계 계산
 *   - MVP 선정
 *   - 리포트 임베드 생성
 *   - Discord 채널에 발송
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { getRoundReporter } from '../schedulers/round-reporter';
import { initNotificationService } from '../services/notification.service';
import { getCurrentRound } from '../services/round.service';
import { getDb, attendance, posts, members } from '@blog-study/shared/db';
import { eq, and, count, sql } from 'drizzle-orm';
import { loadBotEnv } from '@blog-study/shared';

async function main() {
  console.log('🧪 회차 리포트 수동 테스트 시작...\n');

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

    // NotificationService 초기화
    initNotificationService(client);
    console.log('✅ NotificationService 초기화 완료\n');

    // 1. 현재 회차 확인
    console.log('--- Step 1: 현재 회차 확인 ---');
    const currentRound = await getCurrentRound();
    console.log(`📅 현재 회차: ${currentRound.roundNumber}회차`);
    console.log(`   시작일: ${currentRound.startDate}`);
    console.log(`   종료일: ${currentRound.endDate}`);
    console.log(`   유예종료일: ${currentRound.graceEndDate}\n`);

    const db = getDb();

    // 2. 회차 날짜 계산
    const roundStartDate = new Date(currentRound.startDate + 'T00:00:00.000Z');
    const roundEndDate = new Date(currentRound.endDate + 'T23:59:59.999Z');
    const roundGraceEndDate = new Date(currentRound.graceEndDate + 'T23:59:59.999Z');

    const now = new Date();
    const isAfterGrace = now > roundGraceEndDate;

    console.log('--- Step 2: 회차 기간 확인 ---');
    console.log(`   현재 시간 (KST): ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`   회차 시작일: ${roundStartDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`   회차 종료일: ${roundEndDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`   유예 종료일: ${roundGraceEndDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`   유예 기간 종료: ${isAfterGrace ? '✅' : '❌'}\n`);

    // 3. 출석 통계 조회
    console.log('--- Step 3: 출석 통계 조회 ---');
    const attendanceStats = await db
      .select({
        status: attendance.status,
        count: count(),
      })
      .from(attendance)
      .where(eq(attendance.roundId, currentRound.id))
      .groupBy(attendance.status);

    const stats = Object.fromEntries(attendanceStats.map(s => [s.status, s.count]));

    const totalMembers = (stats.PENDING || 0) + (stats.SUBMITTED || 0) + (stats.LATE || 0) + (stats.ABSENT || 0);
    const submitted = stats.SUBMITTED || 0;
    const late = stats.LATE || 0;
    const absent = stats.ABSENT || 0;
    const pending = stats.PENDING || 0;

    console.log(`   전체 멤버: ${totalMembers}명`);
    console.log(`   ✅ 제출완료: ${submitted}명 (${(submitted / totalMembers * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  지각: ${late}명 (${(late / totalMembers * 100).toFixed(1)}%)`);
    console.log(`   ❌ 결석: ${absent}명 (${(absent / totalMembers * 100).toFixed(1)}%)`);
    console.log(`   ⏳ 대기중: ${pending}명 (${(pending / totalMembers * 100).toFixed(1)}%)\n`);

    // 4. 포스트 통계 조회
    console.log('--- Step 4: 포스트 통계 조회 ---');
    const postStats = await db
      .select({
        memberId: posts.memberId,
        postCount: count(),
      })
      .from(posts)
      .where(eq(posts.roundId, currentRound.id))
      .groupBy(posts.memberId)
      .orderBy(sql`count(*) DESC`);

    const totalPosts = postStats.reduce((sum, s) => sum + s.postCount, 0);
    const avgPosts = totalPosts / Math.max(1, totalMembers);

    console.log(`   전체 포스트: ${totalPosts}개`);
    console.log(`   평균 포스트: ${avgPosts.toFixed(1)}개/명`);
    console.log(`   포스트 작성자: ${postStats.length}명\n`);

    // 5. 포디움 (MVP)
    console.log('--- Step 5: 포디움 (MVP) ---');
    const podium = postStats.slice(0, 3);

    if (podium.length > 0) {
      console.log(`   🥇 1위: ${podium[0].postCount}개 포스트`);
      if (podium.length > 1) {
        console.log(`   🥈 2위: ${podium[1].postCount}개 포스트`);
      }
      if (podium.length > 2) {
        console.log(`   🥉 3위: ${podium[2].postCount}개 포스트`);
      }
    } else {
      console.log('   포스트가 없습니다.');
    }
    console.log('');

    // 6. 멤버별 상세 현황
    console.log('--- Step 6: 멤버별 상세 현황 (Top 10) ---');
    const memberDetails = await db
      .select({
        member: members,
        attendanceStatus: attendance.status,
        postCount: count(),
      })
      .from(attendance)
      .innerJoin(members, eq(attendance.memberId, members.id))
      .leftJoin(posts, and(
        eq(posts.memberId, attendance.memberId),
        eq(posts.roundId, currentRound.id)
      ))
      .where(eq(attendance.roundId, currentRound.id))
      .groupBy(members.id, attendance.id)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    memberDetails.forEach((detail, index) => {
      const statusIcon = {
        'SUBMITTED': '✅',
        'LATE': '⚠️',
        'ABSENT': '❌',
        'PENDING': '⏳',
      }[detail.attendanceStatus] || '❓';

      console.log(`   ${index + 1}. ${statusIcon} ${detail.member.name} (@${detail.member.discordUsername || 'N/A'})`);
      console.log(`      포스트: ${detail.postCount}개 | 출석: ${detail.attendanceStatus}`);
    });
    console.log('');

    // 7. 리포트 발송
    if (isAfterGrace) {
      console.log('--- Step 7: 회차 리포트 발송 ---');

      const roundReporter = getRoundReporter();

      const reportResult = await roundReporter.sendRoundReport();

      console.log(`\n📋 발송 결과:`);
      console.log(`   발송 여부: ${reportResult.reportSent ? '✅ 성공' : '❌ 실패'}`);

      if (reportResult.errors.length > 0) {
        console.log(`\n❌ 에러:`);
        reportResult.errors.forEach(err => console.log(`   - ${err}`));
      }

      if (reportResult.warnings && reportResult.warnings.length > 0) {
        console.log(`\n⚠️  경고:`);
        reportResult.warnings.forEach(w => console.log(`   - ${w}`));
      }

      console.log('\n✅ 회차 리포트 발송 완료!');
    } else {
      console.log('--- Step 7: 회차 리포트 발송 ---');
      console.log('   아직 유예 기간이 종료되지 않았습니다.');
      console.log('   리포트는 유예 기간 종료 후에 발송됩니다.');
      console.log('\n⏳ 유예 기간 종료 대기 중...');
    }

    // 8. 최종 요약
    console.log('\n--- 최종 요약 ---');
    console.log(`📊 ${currentRound.roundNumber}회차 통계`);
    console.log(`   제출률: ${(submitted / totalMembers * 100).toFixed(1)}% (${submitted}/${totalMembers})`);
    console.log(`   완료율: ${((submitted + late) / totalMembers * 100).toFixed(1)}% (${submitted + late}/${totalMembers})`);
    console.log(`   총 포스트: ${totalPosts}개 (평균 ${avgPosts.toFixed(1)}개/명)`);
    if (podium.length > 0) {
      console.log(`   MVP: ${podium[0].postCount}개 포스트`);
    }

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
