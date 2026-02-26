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
import type { CrawledContent } from './services/curation.service';
import { getPostService } from './services/post.service';
import { getNotificationService } from './services/notification.service';
import { getScoreService } from './services/score.service';
import { ActivityScoreType, curationSources, getDb } from '@blog-study/shared/db';
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
  { name: 'curation-crawl', cron: '0 23 * * *' },  // UTC 23시 = KST 8시(+1일)
  { name: 'curation-share', cron: '0 10 * * *' },
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

  fineReminder.setClient(client);
  roundReporter.setClient(client);
  curationCrawler.setClient(client);

  // Set up RSS poller callback: new post → save to DB + send notification + grant score
  const postService = getPostService();
  const notificationService = getNotificationService();
  const scoreService = getScoreService();

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

  // Schedule all cron jobs
  for (const job of JOB_DEFINITIONS) {
    await boss.schedule(job.name, job.cron);
    console.log(`  📅 Scheduled: ${job.name} (${job.cron})`);
  }

  // Register workers
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

  console.log(`✅ All ${JOB_DEFINITIONS.length} scheduled jobs registered`);
}
