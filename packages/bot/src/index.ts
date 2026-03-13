// @blog-study/bot
// 큐스팅 4th 디스코드 봇 엔트리포인트

import { loadBotEnv } from '@blog-study/shared';
import { createBotClient, setupEventHandlers, setupGracefulShutdown, startBot } from './bot';
import { startJobQueue, stopJobQueue } from './job-queue';
import { registerAllJobs } from './scheduler-registry';
import { setupActivityHandler } from './handlers/activity-handler';
import { setupDMHandler } from './handlers/dm-handler';
import { initNotificationService } from './services/notification.service';
import logger from './lib/logger';

async function main(): Promise<void> {
  logger.info('Blog Study Discord Bot starting...');

  // Load environment variables
  const env = loadBotEnv();
  logger.info('Environment variables loaded');

  // Create bot client
  const client = createBotClient();
  logger.debug('Bot client created');

  // Setup event handlers
  setupEventHandlers(client);
  setupActivityHandler(client);
  setupDMHandler(client);
  logger.debug('Event handlers configured');

  // Initialize notification service
  initNotificationService(client);
  logger.debug('Notification service initialized');

  // Start pg-boss job queue and register all scheduled jobs
  const boss = await startJobQueue(env.DATABASE_URL_DIRECT);
  await registerAllJobs(boss, client);

  // Setup graceful shutdown (includes pg-boss cleanup)
  setupGracefulShutdown(client, async () => {
    await stopJobQueue();
  });

  // Start the bot
  await startBot(client, env.DISCORD_TOKEN);
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start bot');
  process.exit(1);
});
