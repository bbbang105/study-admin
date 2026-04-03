/**
 * DM Handler
 * 벌금 납부 확인을 위한 버튼 기반 상호작용 처리
 * Requirements: 8.2
 * MessageContent Intent 없이 동작하도록 버튼/인터랙션 방식 사용
 * P0 #9 해결: 인메모리 Map → DB 영속화로 변경
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
      logger.error({ discordId }, '💬 [DM] 유저를 찾을 수 없음');
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
      `🏦 **계좌**: 3333333114501 (카카오뱅크)`,
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
    await logNotification({
      source: 'bot', type: 'fine_notification',
      targetDiscordId: discordId,
      summary: `${roundNumber}회차 벌금 알림 (${amount.toLocaleString()}원)`,
      status: 'sent',
    });

    // Track pending confirmation in DB
    await addPendingConfirmation(discordId, fineId);

    logger.info({ discordId, fineId }, '💬 [DM] 벌금 알림 발송 완료');
    return true;
  } catch (error) {
    await logNotification({
      source: 'bot', type: 'fine_notification',
      targetDiscordId: discordId,
      summary: `${roundNumber}회차 벌금 알림 (${amount.toLocaleString()}원)`,
      status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
    });
    logger.error({ discordId, error: serializeError(error) }, '💬 [DM] 벌금 알림 발송 실패');
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
      logger.error({ discordId }, '💬 [DM] 유저를 찾을 수 없음');
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
      `🏦 **계좌**: 3333333114501 (카카오뱅크)`,
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
    await logNotification({
      source: 'bot', type: 'fine_reminder',
      targetDiscordId: discordId,
      summary: `${roundNumber}회차 벌금 리마인더 (${daysSinceCreation}일 경과)`,
      status: 'sent',
    });

    // Ensure pending confirmation is tracked in DB
    await addPendingConfirmation(discordId, fineId);

    logger.info({ discordId, fineId }, '💬 [DM] 벌금 리마인더 발송 완료');
    return true;
  } catch (error) {
    await logNotification({
      source: 'bot', type: 'fine_reminder',
      targetDiscordId: discordId,
      summary: `${roundNumber}회차 벌금 리마인더 (${daysSinceCreation}일 경과)`,
      status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
    });
    logger.error({ discordId, error: serializeError(error) }, '💬 [DM] 벌금 리마인더 발송 실패');
    return false;
  }
}

/**
 * Send poll reminder DM to a user
 * 투표 마감 전 미참여자에게 리마인더 발송
 */
export async function sendPollReminderDM(
  client: Client,
  discordId: string,
  pollQuestion: string,
  expiresAt: Date,
  postId: string,
): Promise<boolean> {
  try {
    const user = await client.users.fetch(discordId);
    if (!user) {
      logger.error({ discordId }, '💬 [DM] 유저를 찾을 수 없음');
      return false;
    }

    const expiresHour = expiresAt.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const webUrl = process.env.WEB_URL || 'https://kusting-web.vercel.app';
    const postUrl = `${webUrl}/board/${postId}`;

    const message = [
      `📊 **투표 참여 요청**`,
      ``,
      `"${pollQuestion}" 투표가 ${expiresHour}에 마감됩니다!`,
      `아직 참여하지 않으셨으니 투표해주세요 🙏`,
    ].join('\n');

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('📊 투표하러 가기')
          .setStyle(ButtonStyle.Link)
          .setURL(postUrl),
      );

    await user.send({
      content: message,
      components: [row],
    });
    await logNotification({
      source: 'bot', type: 'poll_reminder',
      targetDiscordId: discordId,
      summary: `투표 리마인더: ${pollQuestion}`.slice(0, 200),
      status: 'sent',
    });

    logger.info({ discordId, pollQuestion }, '💬 [DM] 투표 리마인더 발송 완료');
    return true;
  } catch (error) {
    await logNotification({
      source: 'bot', type: 'poll_reminder',
      targetDiscordId: discordId,
      summary: `투표 리마인더: ${pollQuestion}`.slice(0, 200),
      status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
    });
    logger.error({ discordId, error: serializeError(error) }, '💬 [DM] 투표 리마인더 발송 실패');
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
