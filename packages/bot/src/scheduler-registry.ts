/**
 * Scheduler Registry
 * pg-boss를 통해 모든 cron 잡을 등록하고 스케줄러와 연결
 */

import type { PgBoss } from 'pg-boss';
import type { Client } from 'discord.js';
import axios from 'axios';
import { parseFeed } from 'feedsmith';
import { getRssPoller } from './schedulers/rss-poller';
import { getAttendanceChecker } from './schedulers/attendance-checker';
import { getFineReminder } from './schedulers/fine-reminder';
import { getRoundReporter } from './schedulers/round-reporter';
import { getCurationCrawler } from './schedulers/curation-crawler';
import { getWeeklyRanking } from './schedulers/weekly-ranking';
import type { CrawledContent } from './services/curation.service';
import { getPostService } from './services/post.service';
import { getNotificationService } from './services/notification.service';
import { getScoreService } from './services/score.service';
import { getAttendanceService, getFineService } from './services';
import { sendFineNotification } from './handlers/dm-handler';
import { getDb, members, ActivityScoreType, curationSources } from '@blog-study/shared/db';
import { extractOgImage } from '@blog-study/shared/utils';
import { getCurrentRound } from './services/round.service';
import { eq } from 'drizzle-orm';

/**
 * Job definitions with cron schedules
 */
const JOB_DEFINITIONS = [
  { name: 'rss-poll', cron: '*/5 * * * *' },
  { name: 'attendance-check', cron: '0 0 * * 2' },
  { name: 'fine-reminder', cron: '0 10 * * *' },
  { name: 'round-report', cron: '5 0 * * 2' },
  { name: 'round-start', cron: '0 0 * * 1' },
  { name: 'curation-crawl', cron: '0 23 * * *' },
  { name: 'curation-share', cron: '0 10 * * *' },
  { name: 'weekly-ranking', cron: '0 13 * * 0' },  // 매주 일요일 22:00 KST
] as const;

/**
 * Register all scheduled jobs with pg-boss
 * @param boss - pg-boss instance
 * @param client - Discord client for schedulers that need it
 */
export async function registerAllJobs(boss: PgBoss, client: Client): Promise<void> {
  // Initialize scheduler instances with Discord client
  const rssPoller = getRssPoller();
  const attendanceChecker = getAttendanceChecker();
  const fineReminder = getFineReminder();
  const roundReporter = getRoundReporter();
  const curationCrawler = getCurationCrawler();
  const weeklyRanking = getWeeklyRanking();

  fineReminder.setClient(client);
  roundReporter.setClient(client);
  curationCrawler.setClient(client);
  weeklyRanking.setClient(client);

  // Set up RSS poller callback: new post → save to DB + send notification + grant score + update attendance
  const postService = getPostService();
  const notificationService = getNotificationService();
  const scoreService = getScoreService();
  const attendanceService = getAttendanceService();
  const fineService = getFineService();

  // 2025-07-01 이후 발행된 글만 수집
  const POST_CUTOFF_DATE = new Date('2025-07-01T00:00:00Z');

  rssPoller.setOnNewPostCallback(async (member, items) => {
    const currentRound = await getCurrentRound().catch(() => null);

    for (const item of items) {
      if (item.pubDate < POST_CUTOFF_DATE) continue;

      // OG 이미지 추출 (실패해도 글 등록은 진행)
      const thumbnailUrl = await extractOgImage(item.link).catch(() => null);

      const result = await postService.create({
        memberId: member.id,
        roundId: currentRound?.id ?? null,
        title: item.title,
        url: item.link,
        publishedAt: item.pubDate,
        description: item.description,
        thumbnailUrl,
      });

      if (result.isNew) {
        // P0 #3: 출석 상태 업데이트 (제출 또는 지각)
        if (currentRound) {
          // 회차 기간 내 제출 여부 판단
          // endDate는 YYYY-MM-DD 포맷이며, KST (Asia/Seoul) 기준 23:59:59.999까지를 마감으로 처리
          const roundEndDate = new Date(`${currentRound.endDate}T23:59:59.999+09:00`);

          const isLate = item.pubDate > roundEndDate;

          if (isLate) {
            // 지각: 출석 상태 업데이트 + 벌금 부과
            // markLate()와 fineService.create()는 내부에서 중복 방지 로직을 가짐:
            // - markLate(): PENDING 상태일 때만 LATE로 변경 (기존 LATE/ABSENT 유지)
            // - fineService.create(): 동일 회차 벌금이 이미 있으면 기존 벌금 반환
            await attendanceService.markLate(member.id, currentRound.id);
            console.log(`⏰ ${member.name} 지각 처리 (${currentRound.roundNumber}회차)`);

            // 지각 벌금 생성 (이미 존재하면 기존 벌금 반환)
            const fine = await fineService.create(member.id, currentRound.id, 'late');
            await sendFineNotification(
              client,
              member.discordId,
              fine.id,
              fine.amount,
              'late',
              currentRound.roundNumber
            );
          } else {
            // 정상 제출
            // markSubmitted()는 내부에서 PENDING 상태일 때만 SUBMITTED로 변경 (기존 LATE/ABSENT 유지)
            await attendanceService.markSubmitted(member.id, currentRound.id);
            console.log(`✅ ${member.name} 제출 완료 (${currentRound.roundNumber}회차)`);
          }
        }

        // 블로그 포스트 점수 부여 (+30점, 일일 2편 상한)
        const safeTitle = item.title.replace(/[<>"'&]/g, '').slice(0, 200);
        await scoreService.grantScore(
          member.id,
          ActivityScoreType.BLOG_POST,
          `블로그 포스트: ${safeTitle}`,
        );

        await notificationService.sendPostNotification({
          member,
          post: result.post,
          roundNumber: currentRound?.roundNumber ?? null,
        });
      }
    }
  });

  // P0 #4: 결석/지각 벌금 콜백 설정
  // 결석 콜백: 화요일 00:00에 결석자 판정 시 자동 벌금 부과
  attendanceChecker.setOnAbsentCallback(async (attendance, round) => {
    try {
      const db = getDb();
      const [member] = await db
        .select()
        .from(members)
        .where(eq(members.id, attendance.memberId))
        .limit(1);

      if (!member) {
        console.error(`❌ Member not found: ${attendance.memberId}`);
        return;
      }

      // 결석 벌금 생성
      const fine = await fineService.create(attendance.memberId, round.id, 'absent');

      // DM으로 벌금 알림 발송
      await sendFineNotification(
        client,
        member.discordId,
        fine.id,
        fine.amount,
        'absent',
        round.roundNumber
      );

      console.log(`❌ ${member.name} 결석 벌금 부과 (${round.roundNumber}회차, ${fine.amount}원)`);
    } catch (error) {
      console.error(`❌ Failed to process absent callback for ${attendance.memberId}:`, error);
    }
  });

  // Set up curation crawl function: fetch RSS → parse → extract content → return CrawledContent[]
  // P1 #8: 큐레이션 데이터 품질 개선 - description, thumbnailUrl 추출
  curationCrawler.setCrawlFunction(async (url: string): Promise<CrawledContent[]> => {
    // Look up the source's rssUrl from DB (source.url might differ from RSS URL)
    const db = getDb();
    const [source] = await db
      .select({ rssUrl: curationSources.rssUrl })
      .from(curationSources)
      .where(eq(curationSources.url, url))
      .limit(1);

    const feedUrl = source?.rssUrl || url;

    const response = await axios.get(feedUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
    });

    const result = parseFeed(response.data);
    if (!result) return [];

    // P1 #8: 공유 유틸리티 사용
    const { extractFeedItems, sanitizeDescription, extractOgImage } = await import('@blog-study/shared/utils');
    const feedItems = extractFeedItems(result);

    // P1 #8: 성능 개선 - OG 이미지 추출 병렬 처리
    const validItems = feedItems.filter((item) => item.link && item.title);

    // description은 동기 처리로 먼저 수행
    const itemsWithDescription = validItems.map((item) => ({
      ...item,
      description: sanitizeDescription(item.description),
    }));

    // OG 이미지는 병렬로 추출
    const thumbnailResults = await Promise.allSettled(
      itemsWithDescription.map((item) => extractOgImage(item.link!))
    );

    const crawledContents: CrawledContent[] = itemsWithDescription.map((item, index) => {
      const result = thumbnailResults[index];
      return {
        title: item.title!,
        url: item.link!,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        category: '',
        tags: item.categories ?? [],
        description: item.description,
        thumbnailUrl: result?.status === 'fulfilled' ? result.value : null,
      };
    });

    return crawledContents;
  });

  // Register workers FIRST (this creates the queues in the queue table)
  await boss.work('rss-poll', { batchSize: 1 }, async () => {
    await rssPoller.poll();
  });

  await boss.work('attendance-check', { batchSize: 1 }, async () => {
    await attendanceChecker.check();
  });

  await boss.work('fine-reminder', { batchSize: 1 }, async () => {
    await fineReminder.sendReminders();
  });

  await boss.work('round-report', { batchSize: 1 }, async () => {
    await roundReporter.sendRoundReport();
  });

  await boss.work('round-start', { batchSize: 1 }, async () => {
    await roundReporter.sendRoundStartAnnouncement();
  });

  await boss.work('curation-crawl', { batchSize: 1 }, async () => {
    await curationCrawler.crawl();
  });

  await boss.work('curation-share', { batchSize: 1 }, async () => {
    await curationCrawler.shareDailyContent();
  });

  // Create weekly-ranking queue explicitly using pg-boss internal API
  await boss.createQueue('weekly-ranking');

  await boss.work('weekly-ranking', { batchSize: 1 }, async () => {
    await weeklyRanking.sendWeeklyRanking();
  });

  // Wait for queues to be created in the database
  await new Promise(resolve => setTimeout(resolve, 500));

  // THEN schedule all cron jobs (after queues are created)
  for (const job of JOB_DEFINITIONS) {
    await boss.schedule(job.name, job.cron);
    console.log(`  📅 Scheduled: ${job.name} (${job.cron})`);
  }

  console.log(`✅ All ${JOB_DEFINITIONS.length} scheduled jobs registered`);
}
