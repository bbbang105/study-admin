import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { fcmTokens } = sharedDb;

export async function POST(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { token, deviceInfo } = await request.json();

    if (!token) {
      return Errors.badRequest('FCM 토큰이 필요합니다.').toResponse();
    }

    const database = getDb();

    await database
      .insert(fcmTokens)
      .values({
        memberId: auth.memberId,
        token,
        deviceInfo,
      })
      .onConflictDoUpdate({
        target: [fcmTokens.memberId, fcmTokens.token],
        set: {
          lastUsedAt: new Date(),
          deviceInfo,
        },
      });

    return successResponse({ subscribed: true }, '알림이 구독되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
