import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';

const { sessions } = sharedDb;

export interface LogoutResponse {
  success: boolean;
  message: string;
}

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 * Requirement: 17.8
 */
export async function POST(request: NextRequest): Promise<NextResponse<LogoutResponse>> {
  try {
    const sessionToken = request.cookies.get('session-token')?.value;

    if (sessionToken) {
      const database = db();

      // Invalidate session token (Requirement 17.8)
      await database
        .delete(sessions)
        .where(eq(sessions.token, sessionToken));
    }

    // Create response and clear cookies
    const response = NextResponse.json(
      { success: true, message: '로그아웃되었습니다.' },
      { status: 200 }
    );

    // Clear auth token cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    // Clear session token cookie
    response.cookies.set('session-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
