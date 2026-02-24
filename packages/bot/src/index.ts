// @blog-study/bot
// 블로그 스터디 디스코드 봇 엔트리포인트

import { loadBotEnv } from '@blog-study/shared';
import {
  createBotClient,
  setupEventHandlers,
  loadCommands,
  registerCommands,
  startBot,
  setupGracefulShutdown,
} from './bot';
import { getAllCommands } from './commands';
import { startJobQueue, stopJobQueue } from './job-queue';
import { registerAllJobs } from './scheduler-registry';

async function main(): Promise<void> {
  console.log('🚀 Blog Study Discord Bot starting...');

  // Load environment variables
  const env = loadBotEnv();
  console.log('✅ Environment variables loaded');

  // Create bot client
  const client = createBotClient();
  console.log('✅ Bot client created');

  // Get all commands
  const commands = getAllCommands();
  console.log(`📦 Found ${commands.length} commands`);

  // Load commands into client
  loadCommands(client, commands);

  // Setup event handlers
  setupEventHandlers(client, env);
  console.log('✅ Event handlers configured');

  // Register slash commands with Discord API
  await registerCommands(commands, env);

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
