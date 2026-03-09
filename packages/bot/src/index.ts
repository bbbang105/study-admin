// @blog-study/bot
// 큐스팅 4th 디스코드 봇 엔트리포인트

import { loadBotEnv } from '@blog-study/shared';
import { createBotClient, setupEventHandlers, setupGracefulShutdown, startBot } from './bot';
import { startJobQueue, stopJobQueue } from './job-queue';
import { registerAllJobs } from './scheduler-registry';
import { setupActivityHandler } from './handlers/activity-handler';
import { initNotificationService } from './services/notification.service';

async function main(): Promise<void> {
  console.log('🚀 Blog Study Discord Bot starting...');

  // Load environment variables
  const env = loadBotEnv();
  console.log('✅ Environment variables loaded');

  // Create bot client
  const client = createBotClient();
  console.log('✅ Bot client created');

  // Setup event handlers
  setupEventHandlers(client);
  setupActivityHandler(client);
  console.log('✅ Event handlers configured');

  // Initialize notification service
  initNotificationService(client);
  console.log('✅ Notification service initialized');

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
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});
