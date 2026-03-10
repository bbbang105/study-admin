/**
 * DM Handler
 * 벌금 납부 확인을 위한 버튼 기반 상호작용 처리
 * Requirements: 8.2
 * MessageContent Intent 없이 동작하도록 버튼/인터랙션 방식 사용
 */

import { Client, Events, ButtonBuilder, ButtonStyle, ActionRowBuilder, Interaction } from 'discord.js';
import {
  getFineService,
  formatFineReason,
} from '../services';

/**
 * Track pending fine confirmations
 * Maps Discord user ID to their pending fine IDs
 */
const pendingConfirmations = new Map<string, string[]>();

/**
 * Add a pending fine confirmation for a user
 */
export function addPendingConfirmation(discordId: string, fineId: string): void {
  const existing = pendingConfirmations.get(discordId) || [];
  if (!existing.includes(fineId)) {
    existing.push(fineId);
    pendingConfirmations.set(discordId, existing);
  }
}

/**
 * Remove a pending fine confirmation for a user
 */
export function removePendingConfirmation(discordId: string, fineId: string): void {
  const existing = pendingConfirmations.get(discordId) || [];
  const filtered = existing.filter(id => id !== fineId);
  if (filtered.length > 0) {
    pendingConfirmations.set(discordId, filtered);
  } else {
    pendingConfirmations.delete(discordId);
  }
}

/**
 * Get pending fine confirmations for a user
 */
export function getPendingConfirmations(discordId: string): string[] {
  return pendingConfirmations.get(discordId) || [];
}

/**
 * Clear all pending confirmations for a user
 */
export function clearPendingConfirmations(discordId: string): void {
  pendingConfirmations.delete(discordId);
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
  if (!interaction.channel || interaction.channel.type !== 1) { // 1 = DM
    return;
  }

  const customId = interaction.customId;

  // Check if this is a payment confirmation button
  if (!customId.startsWith('confirm_payment_')) {
    return;
  }

  const fineId = customId.replace('confirm_payment_', '');
  const discordId = interaction.user.id;

  // Verify this fine is pending for this user
  const pendingFines = getPendingConfirmations(discordId);
  if (!pendingFines.includes(fineId)) {
    try {
      await interaction.reply({
        content: '❌ 이 벌금은 이미 처리되었거나 유효하지 않습니다.',
        ephemeral: true,
      });
    } catch (error) {
      console.error('❌ Failed to send error reply:', error);
    }
    return;
  }

  const fineService = getFineService();

  try {
    await fineService.markPaid(fineId);
    removePendingConfirmation(discordId, fineId);

    console.log(`✅ Fine ${fineId} marked as paid for user ${discordId}`);

    try {
      await interaction.reply({
        content: '✅ 벌금 납부가 확인되었습니다! 감사합니다. 🙏',
        ephemeral: false,
      });
    } catch (error) {
      console.error('❌ Failed to send confirmation reply:', error);
    }
  } catch (error) {
    console.error(`❌ Failed to mark fine ${fineId} as paid:`, error);
    try {
      await interaction.reply({
        content: '❌ 납부 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
        ephemeral: true,
      });
    } catch (replyError) {
      console.error('❌ Failed to send error reply:', replyError);
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
      console.error(`❌ User ${discordId} not found`);
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

    // Track pending confirmation
    addPendingConfirmation(discordId, fineId);

    console.log(`📤 Fine notification sent to ${discordId} for fine ${fineId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send fine notification to ${discordId}:`, error);
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
      console.error(`❌ User ${discordId} not found`);
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

    // Ensure pending confirmation is tracked
    addPendingConfirmation(discordId, fineId);

    console.log(`📤 Fine reminder sent to ${discordId} for fine ${fineId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send fine reminder to ${discordId}:`, error);
    return false;
  }
}

/**
 * Setup DM handler for the bot client
 * MessageContent Intent 없이 버튼 인터랙션으로 동작
 */
export function setupDMHandler(client: Client): void {
  // Listen for button interactions
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleButtonInteraction(interaction);
    } catch (error) {
      console.error('❌ Error handling button interaction:', error);
    }
  });

  console.log('📬 DM handler setup complete (button-based)');
}
