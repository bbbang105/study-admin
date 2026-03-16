// @blog-study/bot
// 큐스팅 4th 디스코드 봇 엔트리포인트

// Sentry must be initialized before anything else
import './lib/sentry';

import { loadBotEnv } from '@blog-study/shared';
import { createBotClient, setupEventHandlers, setupGracefulShutdown, startBot } from './bot';
import { startJobQueue, stopJobQueue } from './job-queue';
import { registerAllJobs } from './scheduler-registry';

import { setupDMHandler } from './handlers/dm-handler';
import { initNotificationService } from './services/notification.service';
import { startBotApiServer } from './api-server';
import logger, { serializeError } from './lib/logger';
import { Sentry } from './lib/sentry';

async function main(): Promise<void> {
  logger.info('🤖 [Bot] Blog Study Discord Bot 시작 중...');

  // Load environment variables
  const env = loadBotEnv();
  logger.info('🤖 [Bot] 환경 변수 로드 완료');

  // Create bot client
  const client = createBotClient();
  logger.debug('🤖 [Bot] 클라이언트 생성 완료');

  // Setup event handlers
  setupEventHandlers(client);
  setupDMHandler(client);
  logger.debug('🤖 [Bot] 이벤트 핸들러 등록 완료');

  // Initialize notification service
  initNotificationService(client);
  logger.debug('📢 [알림] 알림 서비스 초기화 완료');

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
  logger.info(`🌐 [API] Bot API 서버 시작 (포트: ${apiPort})`);

  // Start the bot
  await startBot(client, env.DISCORD_TOKEN);
}

main().catch(async (error) => {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  logger.error({ error: serializeError(errorObj) }, '🤖 [Bot] 시작 실패');
  Sentry.captureException(errorObj);

  await Sentry.flush(2000);
  process.exit(1);
});
