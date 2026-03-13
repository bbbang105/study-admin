import { Client, Events, GatewayIntentBits, } from 'discord.js';
import logger, { serializeError } from './lib/logger';
import { reportError } from './lib/error-webhook';

/**
 * Create and configure the Discord bot client
 */
export function createBotClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      // MessageContent Intent 없이 버튼/인터랙션 방식으로 동작
      // 봇이 100개 미만 서버라 Intent 활성화 불가능
      // GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
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
    }, 'Bot logged in');
  });

  // Error handling
  client.on(Events.Error, async (error) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error({ error: serializeError(errorObj) }, 'Discord client error');

    // Send critical error notification to Discord webhook
    await reportError(errorObj, {
      location: 'Discord.Client',
      event: 'error',
    }).catch(() => {
      // Ignore webhook errors
    });
  });

  client.on(Events.Warn, (warning) => {
    logger.warn({ warning }, 'Discord client warning');
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
    logger.info({ signal }, 'Received shutdown signal, shutting down gracefully...');
    if (onShutdown) {
      await onShutdown();
    }
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
