/**
 * 벌금 리마인더 수동 테스트 스크립트
 *
 * 사용법:
 *   pnpm --filter @blog-study/bot test-fine-reminder
 *
 * 전제 조건:
 *   1. Discord 봇이 실행 중이어야 함
 *   2. 미납 벌금이 있는 멤버가 있어야 함
 *   3. config 테이블에 NOTICE_CHANNEL이 설정되어 있어야 함
 *
 * 테스트 내용:
 *   - 미납 벌금 목록 조회
 *   - 3일 경과 벌금 필터링
 *   - DM 발송 테스트
 *   - 리마인더 발송 로그
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { getFineReminder } from '../schedulers/fine-reminder';
import { getFineService } from '../services/fine.service';
import { loadBotEnv } from '@blog-study/shared';
import { getDb, fines, members } from '@blog-study/shared/db';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🧪 벌금 리마인더 수동 테스트 시작...\n');

  // 환경 변수 로드
  loadBotEnv();

  // Discord 클라이언트 생성
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
    ],
  });

  try {
    // Discord 봇 로그인
    console.log('📡 Discord 봇 로그인 중...');
    await client.login(process.env.DISCORD_TOKEN!);
    console.log('✅ Discord 봇 로그인 성공\n');

    const db = getDb();

    // 1. 전체 벌금 현황 조회
    console.log('--- Step 1: 전체 벌금 현황 ---');
    const allFines = await db
      .select({
        fine: fines,
        member: members,
      })
      .from(fines)
      .innerJoin(members, eq(fines.memberId, members.id))
      .orderBy(fines.createdAt);

    const statusMap = {
      PENDING: allFines.filter(f => f.fine.status === 'PENDING').length,
      PAID: allFines.filter(f => f.fine.status === 'PAID').length,
      WAIVED: allFines.filter(f => f.fine.status === 'WAIVED').length,
    };

    const totalAmount = allFines
      .filter(f => f.fine.status === 'PENDING')
      .reduce((sum, f) => sum + f.fine.amount, 0);

    console.log(`   전체 벌금: ${allFines.length}건`);
    console.log(`   ⏳ 미납 (PENDING): ${statusMap.PENDING}건 (총 ${totalAmount.toLocaleString()}원)`);
    console.log(`   ✅ 납부완료 (PAID): ${statusMap.PAID}건`);
    console.log(`   ⛔ 면제 (WAIVED): ${statusMap.WAIVED}건\n`);

    // 2. 미납 벌금 목록
    console.log('--- Step 2: 미납 벌금 목록 ---');
    const pendingFines = allFines.filter(f => f.fine.status === 'PENDING');

    if (pendingFines.length === 0) {
      console.log('   미납 벌금이 없습니다.\n');
      console.log('✅ 테스트 완료! (미납 벌금 없음)');
      return;
    }

    const now = new Date();

    // 경과 일수 계산
    const finesWithDays = pendingFines.map(f => {
      const createdAt = new Date(f.fine.createdAt);
      const daysSinceCreation = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...f,
        daysSinceCreation,
      };
    });

    // 3일 경과 벌금 필터링
    const eligibleForReminder = finesWithDays.filter(f => f.daysSinceCreation >= 3);
    const recentFines = finesWithDays.filter(f => f.daysSinceCreation < 3);

    console.log(`   리마인더 대상 (3일 경과): ${eligibleForReminder.length}건`);
    console.log(`   최근 부과 (3일 미만): ${recentFines.length}건\n`);

    if (eligibleForReminder.length > 0) {
      console.log('   📋 리마인더 대상 벌금:');
      eligibleForReminder.forEach(f => {
        const typeLabel = f.fine.type === 'late' ? '지각' : '결석';
        console.log(`      - ${f.member.name} (@${f.member.discordUsername || 'N/A'})`);
        console.log(`        ${f.fine.roundNumber}회차 ${typeLabel} ${f.fine.amount.toLocaleString()}원 (${f.daysSinceCreation}일 경과)`);
        console.log(`        생성일: ${new Date(f.fine.createdAt).toLocaleString('ko-KR')}`);
      });
      console.log('');
    }

    if (recentFines.length > 0) {
      console.log('   📋 최근 부과 벌금 (리마인더 제외):');
      recentFines.forEach(f => {
        const typeLabel = f.fine.type === 'late' ? '지각' : '결석';
        console.log(`      - ${f.member.name} (@${f.member.discordUsername || 'N/A'})`);
        console.log(`        ${f.fine.roundNumber}회차 ${typeLabel} ${f.fine.amount.toLocaleString()}원 (${f.daysSinceCreation}일 경과)`);
      });
      console.log('');
    }

    // 3. 리마인더 발송 테스트
    if (eligibleForReminder.length > 0) {
      console.log('--- Step 3: 리마인더 발송 테스트 ---');

      const fineReminder = getFineReminder();
      fineReminder.setClient(client);

      const sendResult = await fineReminder.sendReminders();

      console.log(`\n📋 발송 결과:`);
      console.log(`   대상 멤버: ${sendResult.targetMembers}명`);
      console.log(`   DM 발송 성공: ${sendResult.sentCount}건`);
      console.log(`   DM 발송 실패: ${sendResult.failedCount}건`);

      if (sendResult.sentCount > 0) {
        console.log(`\n✅ DM 발송 성공한 멤버:`);
        sendResult.sentDetails.forEach(detail => {
          console.log(`   - ${detail.memberName} (@${detail.discordUsername || 'N/A'}): ${detail.fineCount}건`);
        });
      }

      if (sendResult.failedCount > 0) {
        console.log(`\n❌ DM 발송 실패한 멤버:`);
        sendResult.failedDetails.forEach(detail => {
          console.log(`   - ${detail.memberName} (@${detail.discordUsername || 'N/A'}): ${detail.error}`);
        });
      }

      if (sendResult.warnings.length > 0) {
        console.log(`\n⚠️  경고:`);
        sendResult.warnings.forEach(w => console.log(`   - ${w}`));
      }

      console.log('\n✅ 리마인더 발송 완료!');
    } else {
      console.log('--- Step 3: 리마인더 발송 테스트 ---');
      console.log('   리마인더 대상이 없습니다. (3일 미경과 미납 벌금 없음)');
      console.log('\n⏳ 리마인더 대상 대기 중...');
    }

    // 4. 미납 벌금 통계
    console.log('\n--- 최종 요약 ---');
    const lateFines = pendingFines.filter(f => f.fine.type === 'late');
    const absentFines = pendingFines.filter(f => f.fine.type === 'absent');

    console.log(`   미납 벌금 총액: ${totalAmount.toLocaleString()}원`);
    console.log(`   지각 벌금: ${lateFines.length}건 (${lateFines.reduce((s, f) => s + f.fine.amount, 0).toLocaleString()}원)`);
    console.log(`   결석 벌금: ${absentFines.length}건 (${absentFines.reduce((s, f) => s + f.fine.amount, 0).toLocaleString()}원)`);
    console.log(`   리마인더 필요: ${eligibleForReminder.length}건`);
    console.log(`   오늘 리마인드 발송: ${eligibleForReminder.filter(f => f.daysSinceCreation >= 3 && f.daysSinceCreation % 3 === 0).length}건`);

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
