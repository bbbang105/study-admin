import { timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db as sharedDb } from '@blog-study/shared';
import { getDb } from '@/lib/db';
import { sendPushToMembers } from '@/lib/push';
import { logNotification } from '@/lib/notification-log';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { members } = sharedDb;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate limit: 30 requests/minute
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(): boolean {
  const key = 'reminder-push';
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    if (!checkRateLimit()) {
      return Errors.badRequest('Rate limit exceeded').toResponse();
    }

    // 내부 API 인증 (timing-safe comparison)
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.INTERNAL_API_KEY;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!expectedKey || !token || !safeCompare(token, expectedKey)) {
      return Errors.unauthorized('Invalid API key').toResponse();
    }

    const body = await request.json();
    const { type, memberIds, title, body: pushBody, clickUrl } = body;

    // 타입 검증
    if (
      typeof type !== 'string' ||
      typeof title !== 'string' ||
      typeof pushBody !== 'string' ||
      typeof clickUrl !== 'string'
    ) {
      return Errors.badRequest('type, memberIds, title, body, clickUrl are required').toResponse();
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return Errors.badRequest('memberIds must be a non-empty array').toResponse();
    }
    if (!memberIds.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
      return Errors.badRequest('Invalid memberIds format').toResponse();
    }
    if (title.length > 200) return Errors.badRequest('title too long (max 200)').toResponse();
    if (pushBody.length > 1000) return Errors.badRequest('body too long (max 1000)').toResponse();
    if (!clickUrl.startsWith('/')) return Errors.badRequest('clickUrl must start with /').toResponse();

    const result = await sendPushToMembers(memberIds, {
      title,
      body: pushBody,
      clickUrl,
      data: { type },
    });

    // 수신자 닉네임 조회 (로그 표시용)
    const database = getDb();
    const recipients = await database
      .select({ id: members.id, nickname: members.nickname })
      .from(members)
      .where(inArray(members.id, memberIds));
    const recipientNicknames = recipients.map((r) => r.nickname);

    // 알림 로그 기록
    await logNotification({
      source: 'web',
      type,
      summary: `[푸시] ${title}: ${pushBody}`.slice(0, 500),
      metadata: {
        memberCount: memberIds.length,
        recipients: recipientNicknames,
        ...result,
      },
      status: result.success > 0 ? 'sent' : 'failed',
      errorMessage:
        result.success === 0 && result.failed > 0
          ? `${result.failed}건 전송 실패`
          : undefined,
    });

    return successResponse(result);
  } catch (error) {
    console.error('[internal/reminder-push] Error:', error);
    return errorResponse(error);
  }
}
