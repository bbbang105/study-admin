import {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  Events,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from 'discord.js';
import type { BotEnv } from '@blog-study/shared';

/**
 * Command handler interface
 */
export interface CommandHandler {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  adminOnly?: boolean;
}

/**
 * Extended Discord client with command collection
 */
export interface BotClient extends Client {
  commands: Collection<string, CommandHandler>;
}

/**
 * Create and configure the Discord bot client
 */
export function createBotClient(): BotClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  }) as BotClient;

  client.commands = new Collection<string, CommandHandler>();

  return client;
}

/**
 * Register slash commands with Discord API
 */
export async function registerCommands(
  commands: CommandHandler[],
  env: BotEnv
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  const commandData = commands.map((cmd) => cmd.data.toJSON());

  console.log(`🔄 Registering ${commandData.length} slash commands...`);

  await rest.put(
    Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
    { body: commandData }
  );

  console.log(`✅ Successfully registered ${commandData.length} slash commands`);
}


/**
 * Setup event handlers for the bot client
 */
export function setupEventHandlers(
  client: BotClient,
  env: BotEnv
): void {
  // Ready event
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`✅ Bot logged in as ${readyClient.user.tag}`);
    console.log(`📊 Serving ${readyClient.guilds.cache.size} guild(s)`);
  });

  // Interaction event (slash commands)
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.warn(`⚠️ Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      // Check admin permission if required
      if (command.adminOnly) {
        const isAdmin = env.ADMIN_DISCORD_IDS.includes(interaction.user.id);
        if (!isAdmin) {
          await interaction.reply({
            content: '❌ 권한이 없습니다. 관리자만 사용할 수 있는 명령어입니다.',
            ephemeral: true,
          });
          return;
        }
      }

      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Error executing command ${interaction.commandName}:`, error);

      const errorMessage = '❌ 명령어 실행 중 오류가 발생했습니다.';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  });

  // Error handling
  client.on(Events.Error, (error) => {
    console.error('❌ Discord client error:', error);
  });

  client.on(Events.Warn, (warning) => {
    console.warn('⚠️ Discord client warning:', warning);
  });
}

/**
 * Load commands into the client's command collection
 */
export function loadCommands(
  client: BotClient,
  commands: CommandHandler[]
): void {
  for (const command of commands) {
    client.commands.set(command.data.name, command);
    console.log(`📝 Loaded command: /${command.data.name}`);
  }
}

/**
 * Start the Discord bot
 */
export async function startBot(
  client: BotClient,
  token: string
): Promise<void> {
  await client.login(token);
}

/**
 * Graceful shutdown handler
 * @param client - Discord bot client
 * @param onShutdown - Optional async cleanup callback (e.g., pg-boss stop)
 */
export function setupGracefulShutdown(client: BotClient, onShutdown?: () => Promise<void>): void {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    if (onShutdown) {
      await onShutdown();
    }
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
