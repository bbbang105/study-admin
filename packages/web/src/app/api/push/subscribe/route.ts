import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { fcmTokens } = sharedDb;

const MAX_TOKEN_LENGTH = 500;
const MAX_DEVICE_INFO_LENGTH = 200;

export async function POST(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { token, deviceInfo } = await request.json();

    if (!token || typeof token !== 'string') {
      return Errors.badRequest('FCM 토큰이 필요합니다.').toResponse();
    }

    if (token.length > MAX_TOKEN_LENGTH) {
      return Errors.badRequest('FCM 토큰이 너무 깁니다.').toResponse();
    }

    const sanitizedDeviceInfo =
      typeof deviceInfo === 'string' ? deviceInfo.slice(0, MAX_DEVICE_INFO_LENGTH) : null;

    const database = getDb();

    await database
      .insert(fcmTokens)
      .values({
        memberId: auth.memberId,
        token,
        deviceInfo: sanitizedDeviceInfo,
      })
      .onConflictDoUpdate({
        target: [fcmTokens.memberId, fcmTokens.token],
        set: {
          lastUsedAt: new Date(),
          deviceInfo: sanitizedDeviceInfo,
        },
      });

    return successResponse({ subscribed: true }, '알림이 구독되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
