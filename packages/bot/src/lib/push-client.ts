import logger from './logger';

interface ReminderPushPayload {
  type: string;
  memberIds: string[];
  title: string;
  body: string;
  clickUrl: string;
}

interface PushResult {
  success: number;
  failed: number;
}

export async function sendReminderPush(payload: ReminderPushPayload): Promise<PushResult> {
  const webUrl = process.env.WEB_URL;
  const apiKey = process.env.INTERNAL_API_KEY;

  if (!webUrl || !apiKey) {
    logger.warn('📱 [Push] WEB_URL 또는 INTERNAL_API_KEY 미설정, 푸시 스킵');
    return { success: 0, failed: payload.memberIds.length };
  }

  try {
    const res = await fetch(`${webUrl}/api/internal/reminder-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error({ status: res.status, body: text }, '📱 [Push] 내부 API 호출 실패');
      return { success: 0, failed: payload.memberIds.length };
    }

    const json = (await res.json()) as { data?: PushResult };
    const result: PushResult = json.data ?? { success: 0, failed: 0 };
    logger.info({ type: payload.type, ...result }, '📱 [Push] 발송 완료');
    return result;
  } catch (error) {
    logger.error({ error, type: payload.type }, '📱 [Push] 내부 API 호출 에러');
    return { success: 0, failed: payload.memberIds.length };
  }
}
