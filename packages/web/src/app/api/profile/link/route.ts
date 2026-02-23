import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { verifyToken } from '@/lib/auth';

const { users, members } = sharedDb;

/**
 * POST /api/profile/link
 * Link user account to a study member by Discord ID
 * Requirement: 18.5
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { discordId } = body;

    if (!discordId || typeof discordId !== 'string') {
      return NextResponse.json(
        { message: 'Discord ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const database = db();

    // Find member by Discord ID
    const [member] = await database
      .select()
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!member) {
      return NextResponse.json(
        { message: '해당 Discord ID로 등록된 스터디원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Check if member is already linked to another user
    const [existingLink] = await database
      .select()
      .from(users)
      .where(eq(users.memberId, member.id))
      .limit(1);

    if (existingLink && existingLink.id !== payload.userId) {
      return NextResponse.json(
        { message: '이 스터디원은 이미 다른 계정에 연결되어 있습니다.' },
        { status: 409 }
      );
    }

    // Link member to user
    await database
      .update(users)
      .set({ 
        memberId: member.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, payload.userId));

    return NextResponse.json({
      message: '스터디원 계정이 연결되었습니다.',
      member: {
        id: member.id,
        discordUsername: member.discordUsername,
        name: member.name,
        onboardingCompleted: member.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error('Profile link API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/link
 * Unlink user account from study member
 */
export async function DELETE() {
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

    await database
      .update(users)
      .set({ 
        memberId: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, payload.userId));

    return NextResponse.json({
      message: '스터디원 계정 연결이 해제되었습니다.',
    });
  } catch (error) {
    console.error('Profile unlink API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
