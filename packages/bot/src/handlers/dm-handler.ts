/**
 * DM Handler
 * 벌금 납부 확인을 위한 버튼 기반 상호작용 처리
 * Requirements: 8.2
 * MessageContent Intent 없이 동작하도록 버튼/인터랙션 방식 사용
 * P0 #9 해결: 인메모리 Map → DB 영속화로 변경
 */

import {
  ChannelType,
  Client,
  Events,
  Interaction,
  TextChannel
} from 'discord.js';
import { fines, getDb, members, rounds } from '@blog-study/shared/db';
import { eq } from 'drizzle-orm';
import { formatFineReason, getFineService, } from '../services';
import { ConfigKeys, getConfigValue } from '../services/round.service';
import logger, { serializeError } from '../lib/logger';
import { logNotification } from '../lib/notification-logger';
import { sendReminderPush } from '../lib/push-client';

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
    logger.error({ fineId, error: serializeError(error) }, '💬 [DM] 납부 확인 대기 등록 실패');
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
    logger.error({ fineId, error: serializeError(error) }, '💬 [DM] 납부 확인 대기 해제 실패');
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

  // 벌금 소유자 검증 + pending 체크
  const db = getDb();
  const [fineOwner] = await db
    .select({ memberId: fines.memberId, discordId: members.discordId })
    .from(fines)
    .innerJoin(members, eq(fines.memberId, members.id))
    .where(eq(fines.id, fineId))
    .limit(1);

  if (!fineOwner || fineOwner.discordId !== discordId) {
    try {
      await interaction.reply({
        content: '❌ 이 벌금에 대한 권한이 없습니다.',
        ephemeral: true,
      });
    } catch (error) {
      logger.error({ error: serializeError(error) }, '💬 [DM] 권한 오류 응답 실패');
    }
    return;
  }

  const isPending = await isPendingConfirmation(fineId);
  if (!isPending) {
    try {
      await interaction.reply({
        content: '❌ 이 벌금은 이미 처리되었거나 유효하지 않습니다.',
        ephemeral: true,
      });
    } catch (error) {
      logger.error({ error: serializeError(error) }, '💬 [DM] 에러 응답 발송 실패');
    }
    return;
  }

  const fineService = getFineService();

  try {
    const paidFine = await fineService.markPaid(fineId);
    await removePendingConfirmation(discordId, fineId);

    logger.info({ fineId, discordId }, '💬 [DM] 벌금 납부 확인 완료');

    try {
      await interaction.reply({
        content: '✅ 벌금 납부가 확인되었습니다! 감사합니다. 🙏',
        ephemeral: false,
      });
    } catch (error) {
      logger.error({ error: serializeError(error) }, '💬 [DM] 확인 응답 발송 실패');
    }

    // 관리자 채널에 납부 알림 발송 (markPaid 반환값 활용 — 재조회 불필요)
    try {
      const db = getDb();
      const [member] = await db
        .select({ name: members.name, nickname: members.nickname })
        .from(members)
        .where(eq(members.discordId, discordId))
        .limit(1);

      if (paidFine && member) {
        const [round] = await db
          .select({ roundNumber: rounds.roundNumber })
          .from(rounds)
          .where(eq(rounds.id, paidFine.roundId))
          .limit(1);

        const displayName = member.name || member.nickname;
        const reason = formatFineReason(paidFine.type as 'late' | 'absent');
        const roundText = round ? `${round.roundNumber}회차` : '';

        const logChannelId = await getConfigValue(ConfigKeys.BOT_LOG_CHANNEL_ID);
        if (logChannelId && interaction.client) {
          const channel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
          if (channel && channel.isTextBased() && !channel.isDMBased()) {
            await (channel as TextChannel).send(
              `💰 **${displayName}**님이 ${roundText} ${reason} 벌금 ${paidFine.amount.toLocaleString()}원 납부를 완료했습니다.`
            );
            await logNotification({
              source: 'bot', type: 'fine_payment',
              channelId: logChannelId,
              summary: `${displayName}님 ${roundText} ${reason} 벌금 납부 확인`,
              status: 'sent',
            });
          }
        }
      }
    } catch (notifyError) {
      logger.error({ error: serializeError(notifyError) }, '💬 [DM] 관리자 납부 알림 발송 실패');
    }
  } catch (error) {
    logger.error({ fineId, error: serializeError(error) }, '💬 [DM] 벌금 납부 처리 실패');
    try {
      await interaction.reply({
        content: '❌ 납부 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
        ephemeral: true,
      });
    } catch (replyError) {
      logger.error({ error: serializeError(replyError) }, '💬 [DM] 에러 응답 발송 실패');
    }
  }
}

/**
 * Send fine notification push to a user
 * Requirements: 8.1 - Send push with fine amount, reason, and payment instructions
 */
export async function sendFineNotification(
  memberId: string,
  fineId: string,
  amount: number,
  type: 'late' | 'absent',
  roundNumber: number
): Promise<boolean> {
  try {
    const reason = formatFineReason(type);
    const result = await sendReminderPush({
      type: 'fine_notification',
      memberIds: [memberId],
      title: '벌금이 부과되었어요',
      body: `${roundNumber}회차 ${reason} 벌금 ${amount.toLocaleString()}원이 부과되었습니다.`,
      clickUrl: '/profile/fines',
    });
    await addPendingConfirmation(memberId, fineId);
    logger.info({ memberId, fineId }, '📱 [Push] 벌금 알림 발송 완료');
    return result.success > 0;
  } catch (error) {
    logger.error({ memberId, error: serializeError(error) }, '📱 [Push] 벌금 알림 발송 실패');
    return false;
  }
}

/**
 * Send fine reminder push to a user
 * Requirements: 8.4 - Send reminder for unpaid fines
 */
export async function sendFineReminder(
  memberId: string,
  fineId: string,
  amount: number,
  type: 'late' | 'absent',
  roundNumber: number,
  daysSinceCreation: number
): Promise<boolean> {
  try {
    const reason = formatFineReason(type);
    const result = await sendReminderPush({
      type: 'fine_reminder',
      memberIds: [memberId],
      title: '미납 벌금 리마인더',
      body: `${roundNumber}회차 ${reason} 벌금 ${amount.toLocaleString()}원이 아직 미납 상태입니다. (${daysSinceCreation}일 경과)`,
      clickUrl: '/profile/fines',
    });
    await addPendingConfirmation(memberId, fineId);
    logger.info({ memberId, fineId }, '📱 [Push] 벌금 리마인더 발송 완료');
    return result.success > 0;
  } catch (error) {
    logger.error({ memberId, error: serializeError(error) }, '📱 [Push] 벌금 리마인더 발송 실패');
    return false;
  }
}

/**
 * Send poll reminder push to a user
 * 투표 마감 전 미참여자에게 푸시 리마인더 발송
 */
export async function sendPollReminderPush(
  memberId: string,
  pollQuestion: string,
  expiresAt: Date,
  postId: string,
): Promise<boolean> {
  try {
    const expiresHour = expiresAt.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const result = await sendReminderPush({
      type: 'poll_reminder',
      memberIds: [memberId],
      title: '투표 참여 요청',
      body: `"${pollQuestion}" 투표가 ${expiresHour}에 마감됩니다! 아직 참여하지 않으셨으니 투표해주세요.`,
      clickUrl: `/board/${postId}`,
    });
    logger.info({ memberId, pollQuestion }, '📱 [Push] 투표 리마인더 발송 완료');
    return result.success > 0;
  } catch (error) {
    logger.error({ memberId, error: serializeError(error) }, '📱 [Push] 투표 리마인더 발송 실패');
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
      logger.error({ error: serializeError(error) }, '💬 [DM] 버튼 인터랙션 처리 에러');
    }
  });

  logger.info('💬 [DM] 핸들러 등록 완료 (버튼 기반, DB 영속화)');
}
