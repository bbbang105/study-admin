/**
 * RSS 폴링 데몬 (백그라운드 실행용)
 * Discord 봇 없이 RSS 수집 + DB 저장을 주기적으로 실행
 *
 * 사용법: cd packages/bot && npx tsx src/scripts/rss-poll-daemon.ts
 */

import { loadBotEnv } from '@blog-study/shared';
import { getRssPoller } from '../schedulers/rss-poller';
import { getPostService } from '../services/post.service';
import { getCurrentRound } from '../services/round.service';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5분

async function runPoll() {
  const startTime = Date.now();
  console.log(`\n[${new Date().toLocaleTimeString('ko-KR')}] 폴링 시작...`);

  try {
    let currentRound: Awaited<ReturnType<typeof getCurrentRound>> | null = null;
    try {
      currentRound = await getCurrentRound();
    } catch {
      // 라운드 없음
    }

    const rssPoller = getRssPoller();
    const postService = getPostService();

    let newCount = 0;
    const POST_CUTOFF_DATE = new Date('2025-07-01T00:00:00Z');

    rssPoller.setOnNewPostCallback(async (member, items) => {
      for (const item of items) {
        if (item.pubDate < POST_CUTOFF_DATE) continue;

        const result = await postService.create({
          memberId: member.id,
          roundId: currentRound?.id ?? null,
          title: item.title,
          url: item.link,
          publishedAt: item.pubDate,
          description: item.description,
        });

        if (result.isNew) {
          newCount++;
          console.log(`  🆕 ${member.discordUsername}: "${item.title}"`);
        }
      }
    });

    const result = await rssPoller.poll();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(
      `  완료: ${result.membersPolled}명 폴링, ${newCount}개 새 글, ${result.errors.length}개 에러 (${elapsed}s)`
    );

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.log(`  ❌ ${err}`);
      }
    }
  } catch (err) {
    console.error('  폴링 실패:', err);
  }
}

async function main() {
  loadBotEnv();
  console.log('🔄 RSS 폴링 데몬 시작 (5분 간격)');
  console.log('   종료: Ctrl+C\n');

  // 즉시 1회 실행
  await runPoll();

  // 이후 5분마다 반복
  setInterval(runPoll, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error('❌ 데몬 시작 실패:', err);
  process.exit(1);
});
