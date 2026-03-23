import { timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { and, inArray, ne } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { sendPushToMembers } from '@/lib/push';
import { decodeHtmlEntities } from '@/lib/sanitize';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { members, MemberStatus } = sharedDb;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate limit: 20 requests/minute
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(): boolean {
  const key = 'internal-push';
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
    const { postId, authorMemberId, authorName, postTitle } = body;

    // 타입 검증
    if (
      typeof postId !== 'string' ||
      typeof authorMemberId !== 'string' ||
      typeof authorName !== 'string' ||
      typeof postTitle !== 'string'
    ) {
      return Errors.badRequest('All fields must be strings').toResponse();
    }

    // UUID 형식 검증
    if (!UUID_RE.test(postId) || !UUID_RE.test(authorMemberId)) {
      return Errors.badRequest('Invalid ID format').toResponse();
    }

    // 길이 제한 (regex 처리 전 방어)
    if (authorName.length > 100 || postTitle.length > 2000) {
      return Errors.badRequest('authorName 또는 postTitle이 너무 깁니다.').toResponse();
    }

    const database = getDb();

    // active + OB + dormant 멤버 조회 (작성자 제외)
    const targetMembers = await database
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          inArray(members.status, [MemberStatus.ACTIVE, MemberStatus.OB, MemberStatus.DORMANT]),
          ne(members.id, authorMemberId)
        )
      );

    if (targetMembers.length === 0) {
      return successResponse({ success: 0, failed: 0 }, '발송 대상 없음');
    }

    const safeName = authorName.replace(/[<>"'&]/g, '').slice(0, 50);
    const safeTitle = decodeHtmlEntities(postTitle).slice(0, 100);

    const result = await sendPushToMembers(
      targetMembers.map((m) => m.id),
      {
        title: '📝 새 글이 등록되었어요',
        body: `${safeName}님이 새 글을 등록했어요: ${safeTitle}`,
        clickUrl: `/posts/${postId}`,
        data: { type: 'new_post' },
      }
    );

    return successResponse(result);
  } catch (error) {
    console.error('[internal/new-post-push] Error:', error);
    return errorResponse(error);
  }
}
