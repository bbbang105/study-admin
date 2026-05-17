// eslint-disable-file
/**
 * RSS 폴링 → DB 저장 테스트 스크립트
 * Discord 봇 없이 RSS 수집 + DB 저장만 단독 실행
 *
 * 사용법: cd packages/bot && npx tsx src/scripts/test-rss-poll.ts
 */

import { loadBotEnv } from '@blog-study/shared';
import { getDb, memberBlogs, members } from '@blog-study/shared/db';
import { and, eq } from 'drizzle-orm';
import { getRssPoller } from '../schedulers/rss-poller';
import { getRssService } from '../services/rss.service';
import { getPostService } from '../services/post.service';
import { getCurrentRound } from '../services/round.service';

const TARGET_DISCORD_USERNAME = 'hsh111366';
const RSS_URL = 'https://bbbang105.github.io/index.xml';

async function main() {
  console.log('🔍 RSS 폴링 → DB 저장 테스트\n');

  // 1. 환경변수 로드
  loadBotEnv();
  console.log('✅ 환경변수 로드 완료\n');

  // 2. RSS 피드 먼저 직접 파싱해서 확인
  console.log('--- Step 1: RSS 피드 파싱 테스트 ---');
  const rssService = getRssService();
  const feedItems = await rssService.fetchFeed(RSS_URL);
  console.log(`📰 피드에서 ${feedItems.length}개 글 발견:\n`);
  for (const item of feedItems.slice(0, 5)) {
    console.log(`  📝 ${item.title}`);
    console.log(`     ${item.link}`);
    console.log(`     ${item.pubDate.toISOString()}\n`);
  }
  if (feedItems.length > 5) {
    console.log(`  ... 외 ${feedItems.length - 5}개\n`);
  }

  // 3. 기존 멤버에 RSS URL 세팅
  console.log('--- Step 2: 멤버 RSS URL 업데이트 ---');
  const db = getDb();
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.discordUsername, TARGET_DISCORD_USERNAME))
    .limit(1);

  if (!member) {
    console.error(`❌ 멤버 "${TARGET_DISCORD_USERNAME}"를 찾을 수 없습니다.`);
    process.exit(1);
  }

  const [existingBlog] = await db
    .select()
    .from(memberBlogs)
    .where(and(eq(memberBlogs.memberId, member.id), eq(memberBlogs.blogUrl, RSS_URL)))
    .limit(1);

  if (existingBlog) {
    await db
      .update(memberBlogs)
      .set({ rssUrl: RSS_URL, rssConsent: true })
      .where(eq(memberBlogs.id, existingBlog.id));
  } else {
    await db.insert(memberBlogs).values({
      memberId: member.id,
      blogUrl: RSS_URL,
      rssUrl: RSS_URL,
      rssConsent: true,
      sortOrder: 0,
    });
  }
  console.log(`✅ ${member.discordUsername}에 RSS URL 설정: ${RSS_URL}\n`);

  // 4. 현재 라운드 확인
  let currentRound: Awaited<ReturnType<typeof getCurrentRound>> | null = null;
  try {
    currentRound = await getCurrentRound();
    console.log(`📅 현재 라운드: ${currentRound.roundNumber}회차\n`);
  } catch {
    console.log('📅 현재 라운드: 없음 (roundId = null로 저장)\n');
  }

  // 5. RSS Poller로 폴링 → DB 저장
  console.log('--- Step 3: RSS 폴링 → DB 저장 ---');
  const rssPoller = getRssPoller();
  const postService = getPostService();

  let newCount = 0;
  let dupCount = 0;

  rssPoller.setOnNewPostCallback(async (m, items) => {
    for (const item of items) {
      const result = await postService.create({
        memberId: m.id,
        roundId: currentRound?.id ?? null,
        title: item.title,
        url: item.link,
        publishedAt: item.pubDate,
        description: item.description,
      });

      if (result.isNew) {
        newCount++;
        console.log(`  🆕 저장: "${item.title}"`);
        console.log(`     ID: ${result.post.id}`);
      } else {
        dupCount++;
        console.log(`  ⏭️  중복: "${item.title}"`);
      }
    }
  });

  const pollResult = await rssPoller.poll();

  // 6. 결과 요약
  console.log('\n--- 결과 요약 ---');
  console.log(`👥 폴링 멤버: ${pollResult.membersPolled}명`);
  console.log(`📰 피드 항목: ${pollResult.totalNewItems}개`);
  console.log(`🆕 새로 저장: ${newCount}개`);
  console.log(`⏭️  중복 스킵: ${dupCount}개`);

  if (pollResult.errors.length > 0) {
    console.log(`\n❌ 에러:`);
    for (const err of pollResult.errors) {
      console.log(`  - ${err}`);
    }
  }

  // 7. DB에서 저장된 글 최종 확인
  const savedPosts = await postService.getByMember(member.id);
  console.log(`\n📦 DB에 저장된 ${member.discordUsername}의 글: ${savedPosts.length}개`);
  for (const post of savedPosts) {
    console.log(`  - ${post.title} (${post.publishedAt?.toISOString?.() ?? 'N/A'})`);
  }

  console.log('\n✅ 테스트 완료!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 실행 실패:', err);
  process.exit(1);
});
