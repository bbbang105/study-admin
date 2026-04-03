import { getDb, discordNotificationLogs } from '@blog-study/shared/db';
import logger from './logger';

interface LogNotificationParams {
  source: 'bot' | 'web';
  type: string;
  channelId?: string;
  channelName?: string;
  targetDiscordId?: string;
  messageId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  status: 'sent' | 'failed';
  errorMessage?: string;
}

export async function logNotification(params: LogNotificationParams): Promise<void> {
  try {
    const db = getDb();
    await db.insert(discordNotificationLogs).values({
      source: params.source,
      type: params.type,
      channelId: params.channelId ?? null,
      channelName: params.channelName ?? null,
      targetDiscordId: params.targetDiscordId ?? null,
      messageId: params.messageId ?? null,
      summary: params.summary.slice(0, 500),
      metadata: params.metadata ?? {},
      status: params.status,
      errorMessage: params.errorMessage ?? null,
    });
  } catch (err) {
    logger.warn({ err, type: params.type }, '⚠️ [알림 로그] DB 저장 실패 (무시)');
  }
}
