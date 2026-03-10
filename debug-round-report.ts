import { loadBotEnv } from '@blog-study/shared';
import { getDb, rounds, attendance, members } from '@blog-study/shared/db';
import { eq } from 'drizzle-orm';
import { getCurrentRound } from './packages/bot/src/services/round.service';
import { getAttendanceSummariesForRound } from './packages/bot/src/schedulers/round-reporter';

async function main() {
  loadBotEnv();

  console.log('=== getCurrentRound() 확인 ===\n');
  const currentRound = await getCurrentRound();
  console.log(`현재 회차: ${currentRound.roundNumber} (ID: ${currentRound.id})`);

  console.log('\n=== getAttendanceSummariesForRound() 확인 ===\n');
  const summaries = await getAttendanceSummariesForRound(currentRound.id);
  console.log(`attendanceSummaries: ${summaries.length}개`);

  summaries.forEach((s, index) => {
    console.log(`${index + 1}. ${s.name} (${s.status}) - ${s.postCount}개 포스트`);
  });

  console.log('\n=== 상태별 개수 ===');
  const submitted = summaries.filter(s => s.status === 'SUBMITTED');
  const late = summaries.filter(s => s.status === 'LATE');
  const absent = summaries.filter(s => s.status === 'ABSENT');

  console.log(`SUBMITTED: ${submitted.length}`);
  console.log(`LATE: ${late.length}`);
  console.log(`ABSENT: ${absent.length}`);
  console.log(`총계: ${summaries.length}`);
}

main();
