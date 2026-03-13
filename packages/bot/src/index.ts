// @blog-study/bot
// 큐스팅 4th 디스코드 봇 엔트리포인트

import { loadBotEnv, getErrorWebhookUrl } from '@blog-study/shared';
import { createBotClient, setupEventHandlers, setupGracefulShutdown, startBot } from './bot';
import { startJobQueue, stopJobQueue } from './job-queue';
import { registerAllJobs } from './scheduler-registry';
import { setupActivityHandler } from './handlers/activity-handler';
import { setupDMHandler } from './handlers/dm-handler';
import { initNotificationService } from './services/notification.service';
import { startBotApiServer } from './api-server';
import logger, { serializeError } from './lib/logger';
import { initErrorWebhook, reportError } from './lib/error-webhook';

async function main(): Promise<void> {
  logger.info('Blog Study Discord Bot starting...');

  // Load environment variables
  const env = loadBotEnv();
  logger.info('Environment variables loaded');

  // Initialize error webhook if configured
  const errorWebhookUrl = getErrorWebhookUrl();
  if (errorWebhookUrl) {
    initErrorWebhook(errorWebhookUrl);
    logger.info('Error webhook initialized');
  }

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

  // Start HTTP API server for manual triggers
  const apiPort = parseInt(process.env.BOT_API_PORT || '3001', 10);
  startBotApiServer(apiPort);
  logger.info(`Bot API server started on port ${apiPort}`);

  // Start the bot
  await startBot(client, env.DISCORD_TOKEN);
}

main().catch((error) => {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  logger.error({ error: serializeError(errorObj) }, 'Failed to start bot');

  // Send error notification to Discord webhook
  reportError(errorObj, {
    location: 'main()',
    phase: 'bot-startup',
  }).catch(() => {
    // Ignore webhook errors during startup
  });

  process.exit(1);
});
