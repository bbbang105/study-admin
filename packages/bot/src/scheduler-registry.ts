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

      const result = await postService.create({
        memberId: member.id,
        roundId: currentRound?.id ?? null,
        title: item.title,
        url: item.link,
        publishedAt: item.pubDate,
        description: item.description,
      });

      if (result.isNew) {
        // P0 #3: 출석 상태 업데이트 (제출 또는 지각)
        if (currentRound) {
          // 회차 기간 내 제출 여부 판단
          const roundEndDate = new Date(currentRound.endDate);
          roundEndDate.setHours(23, 59, 59, 999); // 마감일 23:59:59.999까지

          const isLate = item.pubDate > roundEndDate;

          if (isLate) {
            // 지각: 출석 상태 업데이트 + 벌금 부과
            await attendanceService.markLate(member.id, currentRound.id);
            console.log(`⏰ ${member.name} 지각 처리 (${currentRound.roundNumber}회차)`);

            // 지각 벌금 생성
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

  // Set up curation crawl function: fetch RSS → parse → return CrawledContent[]
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

    // Normalize feed items across formats (RSS/Atom/JSON/RDF)
    interface NormalizedItem {
      title?: string;
      link?: string;
      pubDate?: string;
      categories?: string[];
    }

    let normalized: NormalizedItem[] = [];
    const { format, feed } = result;

    if (format === 'atom') {
      normalized = (feed.entries ?? []).map((entry) => ({
        title: entry.title,
        link: entry.links?.[0]?.href,
        pubDate: entry.published ?? entry.updated,
        categories: entry.categories?.map((c) => c.term).filter(Boolean) as string[],
      }));
    } else if (format === 'rss') {
      normalized = (feed.items ?? []).map((item) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate ? String(item.pubDate) : undefined,
        categories: item.categories?.map((c) => typeof c === 'string' ? c : c.name).filter(Boolean) as string[],
      }));
    } else if (format === 'json') {
      normalized = (feed.items ?? []).map((item) => ({
        title: item.title,
        link: item.url ?? item.external_url,
        pubDate: item.date_published ?? item.date_modified,
        categories: item.tags,
      }));
    } else {
      // RDF
      normalized = (feed.items ?? []).map((item) => ({
        title: item.title,
        link: item.link,
        pubDate: item.dc?.date,
      }));
    }

    return normalized
      .filter((item) => item.title && item.link)
      .map((item) => ({
        title: item.title!,
        url: item.link!,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        category: '',
        tags: item.categories ?? [],
      }));
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
