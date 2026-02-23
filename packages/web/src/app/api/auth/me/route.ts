import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { verifyToken } from '@/lib/auth';

const { users, members } = sharedDb;

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const payload = verifyToken(authToken);
    if (!payload) {
      return NextResponse.json(
        { message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const database = db();
    const [userData] = await database
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!userData) {
      return NextResponse.json(
        { message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let memberData = null;

    // If user is linked to a member, get member info
    if (userData.memberId) {
      const [member] = await database
        .select()
        .from(members)
        .where(eq(members.id, userData.memberId))
        .limit(1);
      
      if (member) {
        memberData = member;
      }
    }

    return NextResponse.json({
      id: userData.id,
      email: userData.email,
      emailVerified: userData.emailVerified,
      memberId: userData.memberId,
      profileImageUrl: memberData?.profileImageUrl,
      name: memberData?.name,
      discordUsername: memberData?.discordUsername,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
