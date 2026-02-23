// Script to deploy slash commands to Discord
// Run with: pnpm deploy-commands

import { loadBotEnv } from '@blog-study/shared';
import { registerCommands } from './bot';
import { getAllCommands } from './commands';

async function main(): Promise<void> {
  console.log('🚀 Deploying slash commands to Discord...');

  const env = loadBotEnv();
  const commands = getAllCommands();

  await registerCommands(commands, env);

  console.log('✅ Commands deployed successfully!');
}

main().catch((error) => {
  console.error('❌ Failed to deploy commands:', error);
  process.exit(1);
});
