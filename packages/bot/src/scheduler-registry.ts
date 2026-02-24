/**
 * Scheduler Registry
 * pg-boss를 통해 모든 cron 잡을 등록하고 스케줄러와 연결
 */

import type { PgBoss } from 'pg-boss';
import type { Client } from 'discord.js';
import { getRssPoller } from './schedulers/rss-poller';
import { getAttendanceChecker } from './schedulers/attendance-checker';
import { getFineReminder } from './schedulers/fine-reminder';
import { getRoundReporter } from './schedulers/round-reporter';
import { getCurationCrawler } from './schedulers/curation-crawler';
import { getPostService } from './services/post.service';
import { getNotificationService } from './services/notification.service';
import { getCurrentRound } from './services/round.service';

/**
 * Job definitions with cron schedules
 */
const JOB_DEFINITIONS = [
  { name: 'rss-poll', cron: '*/5 * * * *' },
  { name: 'attendance-check', cron: '0 0 * * 2' },
  { name: 'fine-reminder', cron: '0 10 * * *' },
  { name: 'round-report', cron: '5 0 * * 2' },
  { name: 'round-start', cron: '0 0 * * 1' },
  { name: 'curation-crawl', cron: '0 9 * * *' },
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

  // Set up RSS poller callback: new post → save to DB + send notification
  const postService = getPostService();
  const notificationService = getNotificationService();

  rssPoller.setOnNewPostCallback(async (member, items) => {
    const currentRound = await getCurrentRound().catch(() => null);

    for (const item of items) {
      const result = await postService.create({
        memberId: member.id,
        roundId: currentRound?.id ?? null,
        title: item.title,
        url: item.link,
        publishedAt: item.pubDate,
        description: item.description,
      });

      if (result.isNew) {
        await notificationService.sendPostNotification({
          member,
          post: result.post,
          roundNumber: currentRound?.roundNumber ?? null,
        });
      }
    }
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
