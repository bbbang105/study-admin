/**
 * DM Handler
 * 벌금 납부 확인을 위한 DM 응답 처리
 * Requirements: 8.2
 */

import { Message, Client, Events } from 'discord.js';
import {
  getFineService,
  isPaymentConfirmation,
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
 * Handle DM message for fine payment confirmation
 * Requirements: 8.2 - Parse confirmation words and update fine status
 */
async function handleDMMessage(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) {
    return;
  }

  // Only process DMs
  if (message.guild) {
    return;
  }

  const discordId = message.author.id;
  const pendingFineIds = getPendingConfirmations(discordId);

  // If no pending confirmations, ignore
  if (pendingFineIds.length === 0) {
    return;
  }

  // Check if message contains confirmation words
  if (!isPaymentConfirmation(message.content)) {
    return;
  }

  const fineService = getFineService();

  // Mark all pending fines as paid
  const paidFines: string[] = [];
  for (const fineId of pendingFineIds) {
    try {
      await fineService.markPaid(fineId);
      paidFines.push(fineId);
      removePendingConfirmation(discordId, fineId);
      
      console.log(`✅ Fine ${fineId} marked as paid for user ${discordId}`);
    } catch (error) {
      console.error(`❌ Failed to mark fine ${fineId} as paid:`, error);
    }
  }

  // Send confirmation message
  if (paidFines.length > 0) {
    try {
      await message.reply({
        content: `✅ 벌금 납부가 확인되었습니다! (${paidFines.length}건)\n감사합니다. 🙏`,
      });
    } catch (error) {
      console.error('❌ Failed to send confirmation reply:', error);
    }
  }
}

/**
 * Send fine notification DM to a user
 * Requirements: 8.1 - Send DM with fine amount, reason, and payment instructions
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
      `납부 완료 후 이 메시지에 "납부완료" 또는 "완료"라고 답장해주세요.`,
      `(영어로 "yes", "done", "paid"도 가능합니다)`,
    ].join('\n');

    await user.send(message);
    
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
 * Send fine reminder DM to a user
 * Requirements: 8.4 - Send reminder for unpaid fines
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
      `납부 완료 후 이 메시지에 "납부완료" 또는 "완료"라고 답장해주세요.`,
    ].join('\n');

    await user.send(message);
    
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
 */
export function setupDMHandler(client: Client): void {
  client.on(Events.MessageCreate, async (message) => {
    try {
      await handleDMMessage(message);
    } catch (error) {
      console.error('❌ Error handling DM message:', error);
    }
  });

  console.log('📬 DM handler setup complete');
}
