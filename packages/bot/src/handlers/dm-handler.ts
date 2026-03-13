/**
 * DM Handler
 * 벌금 납부 확인을 위한 버튼 기반 상호작용 처리
 * Requirements: 8.2
 * MessageContent Intent 없이 동작하도록 버튼/인터랙션 방식 사용
 * P0 #9 해결: 인메모리 Map → DB 영속화로 변경
 */

import { Client, Events, ButtonBuilder, ButtonStyle, ActionRowBuilder, Interaction, ChannelType } from 'discord.js';
import { getDb, fines } from '@blog-study/shared/db';
import { eq } from 'drizzle-orm';
import {
  getFineService,
  formatFineReason,
} from '../services';
import logger, { serializeError } from '../lib/logger';

/**
 * Add a pending fine confirmation for a user
 * DB의 pendingConfirmation 컬럼을 true로 설정
 */
export async function addPendingConfirmation(_discordId: string, fineId: string): Promise<void> {
  const db = getDb();
  try {
    await db
      .update(fines)
      .set({ pendingConfirmation: true })
      .where(eq(fines.id, fineId));
  } catch (error) {
    logger.error({ fineId, error: serializeError(error) }, 'Failed to add pending confirmation');
  }
}

/**
 * Remove a pending fine confirmation for a user
 * DB의 pendingConfirmation 컬럼을 false로 설정
 */
export async function removePendingConfirmation(_discordId: string, fineId: string): Promise<void> {
  const db = getDb();
  try {
    await db
      .update(fines)
      .set({ pendingConfirmation: false })
      .where(eq(fines.id, fineId));
  } catch (error) {
    logger.error({ fineId, error: serializeError(error) }, 'Failed to remove pending confirmation');
  }
}

/**
 * Check if a fine has pending confirmation
 */
async function isPendingConfirmation(fineId: string): Promise<boolean> {
  const db = getDb();
  const [fine] = await db
    .select({ pendingConfirmation: fines.pendingConfirmation })
    .from(fines)
    .where(eq(fines.id, fineId))
    .limit(1);
  return fine?.pendingConfirmation || false;
}


/**
 * Handle button interaction for fine payment confirmation
 * Requirements: 8.2 - Handle button click to confirm payment
 * MessageContent Intent 없이 동작 - 버튼 인터랙션 사용
 */
async function handleButtonInteraction(interaction: Interaction): Promise<void> {
  // Only handle button interactions
  if (!interaction.isButton()) {
    return;
  }

  // Only handle interactions in DMs
  if (!interaction.channel || interaction.channel.type !== ChannelType.DM) {
    return;
  }

  const customId = interaction.customId;

  // Check if this is a payment confirmation button
  if (!customId.startsWith('confirm_payment_')) {
    return;
  }

  const fineId = customId.replace('confirm_payment_', '');
  const discordId = interaction.user.id;

  // Verify this fine is pending for this user (DB 조회)
  const isPending = await isPendingConfirmation(fineId);
  if (!isPending) {
    try {
      await interaction.reply({
        content: '❌ 이 벌금은 이미 처리되었거나 유효하지 않습니다.',
        ephemeral: true,
      });
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Failed to send error reply');
    }
    return;
  }

  const fineService = getFineService();

  try {
    await fineService.markPaid(fineId);
    await removePendingConfirmation(discordId, fineId);

    logger.info({ fineId, discordId }, 'Fine marked as paid');

    try {
      await interaction.reply({
        content: '✅ 벌금 납부가 확인되었습니다! 감사합니다. 🙏',
        ephemeral: false,
      });
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Failed to send confirmation reply');
    }
  } catch (error) {
    logger.error({ fineId, error: serializeError(error) }, 'Failed to mark fine as paid');
    try {
      await interaction.reply({
        content: '❌ 납부 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
        ephemeral: true,
      });
    } catch (replyError) {
      logger.error({ error: serializeError(replyError) }, 'Failed to send error reply');
    }
  }
}

/**
 * Send fine notification DM to a user with payment confirmation button
 * Requirements: 8.1 - Send DM with fine amount, reason, and payment instructions
 * MessageContent Intent 없이 동작 - 버튼 사용
 */
export async function sendFineNotification(
  client: Client,
  discordId: string,
  fineId: string,
  amount: number,
  type: 'late' | 'absent',
  roundNumber: number
): Promise<boolean> {
  try {
    const user = await client.users.fetch(discordId);
    if (!user) {
      logger.error({ discordId }, 'User not found');
      return false;
    }

    const reason = formatFineReason(type);
    const message = [
      `📢 **벌금 알림**`,
      ``,
      `${roundNumber}회차 ${reason}으로 인해 벌금이 부과되었습니다.`,
      ``,
      `💰 **금액**: ${amount.toLocaleString()}원`,
      `📝 **사유**: ${reason}`,
      ``,
      `납부 완료 후 아래 버튼을 클릭해주세요.`,
    ].join('\n');

    // Create payment confirmation button
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_payment_${fineId}`)
          .setLabel('✅ 납부 완료')
          .setStyle(ButtonStyle.Success)
      );

    await user.send({
      content: message,
      components: [row],
    });

    // Track pending confirmation in DB
    await addPendingConfirmation(discordId, fineId);

    logger.info({ discordId, fineId }, 'Fine notification sent');
    return true;
  } catch (error) {
    logger.error({ discordId, error: serializeError(error) }, 'Failed to send fine notification');
    return false;
  }
}

/**
 * Send fine reminder DM to a user with payment confirmation button
 * Requirements: 8.4 - Send reminder for unpaid fines
 * MessageContent Intent 없이 동작 - 버튼 사용
 */
export async function sendFineReminder(
  client: Client,
  discordId: string,
  fineId: string,
  amount: number,
  type: 'late' | 'absent',
  roundNumber: number,
  daysSinceCreation: number
): Promise<boolean> {
  try {
    const user = await client.users.fetch(discordId);
    if (!user) {
      logger.error({ discordId }, 'User not found');
      return false;
    }

    const reason = formatFineReason(type);
    const message = [
      `⏰ **벌금 리마인더**`,
      ``,
      `${roundNumber}회차 ${reason} 벌금이 아직 미납 상태입니다.`,
      `(${daysSinceCreation}일 경과)`,
      ``,
      `💰 **금액**: ${amount.toLocaleString()}원`,
      ``,
      `납부 완료 후 아래 버튼을 클릭해주세요.`,
    ].join('\n');

    // Create payment confirmation button
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_payment_${fineId}`)
          .setLabel('✅ 납부 완료')
          .setStyle(ButtonStyle.Success)
      );

    await user.send({
      content: message,
      components: [row],
    });

    // Ensure pending confirmation is tracked in DB
    await addPendingConfirmation(discordId, fineId);

    logger.info({ discordId, fineId }, 'Fine reminder sent');
    return true;
  } catch (error) {
    logger.error({ discordId, error: serializeError(error) }, 'Failed to send fine reminder');
    return false;
  }
}

/**
 * Setup DM handler for the bot client
 * MessageContent Intent 없이 버튼 인터랙션으로 동작
 * P0 #9 해결: 인메모리 Map → DB 영속화로 변경
 */
export function setupDMHandler(client: Client): void {
  // Listen for button interactions
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleButtonInteraction(interaction);
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error handling button interaction');
    }
  });

  logger.info('DM handler setup complete (button-based, DB-persistent)');
}
