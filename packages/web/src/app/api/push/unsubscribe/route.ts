import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { fcmTokens } = sharedDb;

export async function POST(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { token } = await request.json();

    if (!token) {
      return Errors.badRequest('FCM 토큰이 필요합니다.').toResponse();
    }

    const database = getDb();

    await database
      .delete(fcmTokens)
      .where(
        and(
          eq(fcmTokens.token, token),
          eq(fcmTokens.memberId, auth.memberId)
        )
      );

    return successResponse({ unsubscribed: true }, '구독이 취소되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
