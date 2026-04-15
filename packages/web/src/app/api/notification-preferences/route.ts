import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { FORCE_SEND_TYPES } from '@/lib/push';

const { notificationPreferences, NotificationType } = sharedDb;

/**
 * GET /api/notification-preferences
 * 알림 설정 조회
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const database = getDb();

    // 모든 알림 타입에 대한 설정 조회 (강제 전송 타입은 제외 - 끌 수 없음)
    const allTypes = Object.values(NotificationType).filter((t) => !FORCE_SEND_TYPES.has(t));
    const existing = await database
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.memberId, auth.memberId));

    const existingMap = new Map(existing.map((e) => [e.type, e.enabled]));
    const preferences = allTypes.map((type) => ({
      type,
      enabled: existingMap.get(type) ?? true,
    }));

    return successResponse(preferences);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PUT /api/notification-preferences
 * 알림 설정 업데이트
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const body = await request.json();
    const { type, enabled } = body;

    if (!type || typeof enabled !== 'boolean') {
      return Errors.badRequest('type과 enabled 값을 모두 제공해주세요.').toResponse();
    }

    if (!Object.values(NotificationType).includes(type)) {
      return Errors.badRequest('잘못된 알림 타입입니다.').toResponse();
    }

    const database = getDb();

    await database
      .insert(notificationPreferences)
      .values({
        memberId: auth.memberId,
        type,
        enabled,
      })
      .onConflictDoUpdate({
        target: [notificationPreferences.memberId, notificationPreferences.type],
        set: { enabled, updatedAt: new Date() },
      });

    return successResponse({ type, enabled }, '알림 설정이 저장되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
