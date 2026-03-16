import { Client, Events, GatewayIntentBits, } from 'discord.js';
import logger, { serializeError } from './lib/logger';
import { Sentry } from './lib/sentry';

/**
 * Create and configure the Discord bot client
 */
export function createBotClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
    ],
  });

  return client;
}

/**
 * Setup event handlers for the bot client
 */
export function setupEventHandlers(client: Client): void {
  // Ready event
  client.once(Events.ClientReady, (readyClient) => {
    logger.info({
      botTag: readyClient.user.tag,
      guilds: readyClient.guilds.cache.size,
    }, '🤖 [Bot] 로그인 완료');
  });

  // Error handling
  client.on(Events.Error, (error) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error({ error: serializeError(errorObj) }, '🤖 [Bot] Discord 클라이언트 에러');
    Sentry.captureException(errorObj);
  });

  client.on(Events.Warn, (warning) => {
    logger.warn({ warning }, '🤖 [Bot] Discord 클라이언트 경고');
  });
}

/**
 * Start the Discord bot
 */
export async function startBot(
  client: Client,
  token: string
): Promise<void> {
  await client.login(token);
}

/**
 * Graceful shutdown handler
 * @param client - Discord bot client
 * @param onShutdown - Optional async cleanup callback (e.g., pg-boss stop)
 */
export function setupGracefulShutdown(client: Client, onShutdown?: () => Promise<void>): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, '🤖 [Bot] 종료 시그널 수신, 안전하게 종료 중...');
    if (onShutdown) {
      await onShutdown();
    }
    client.destroy();
    await Sentry.flush(2000);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
