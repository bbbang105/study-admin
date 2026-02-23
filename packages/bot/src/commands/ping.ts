// /핑 명령어 - 봇 상태 확인용
// 봇이 정상적으로 동작하는지 확인하는 간단한 명령어입니다.

import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { CommandHandler } from '../bot';

export const 핑Command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('핑')
    .setDescription('봇이 정상적으로 동작하는지 확인합니다.') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    await interaction.reply({
      content: `🏓 퐁!\n⏱️ 응답 시간: ${latency}ms\n📡 API 지연: ${apiLatency}ms`,
      ephemeral: true,
    });
  },

  adminOnly: false,
};
