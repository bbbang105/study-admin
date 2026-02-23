import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { verifyToken } from '@/lib/auth';

const { users, members } = sharedDb;

/**
 * PUT /api/profile/edit
 * Update profile information
 * Requirement: 20.7
 */
export async function PUT(request: NextRequest) {
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

    // Get user and check if linked to member
    const [userData] = await database
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!userData || !userData.memberId) {
      return NextResponse.json(
        { message: '스터디원 계정이 연결되어 있지 않습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { profileImageUrl, bio, interests, resolution } = body;

    // Validate bio length
    if (bio && bio.length > 200) {
      return NextResponse.json(
        { message: '한줄 소개는 200자 이내로 작성해주세요.' },
        { status: 400 }
      );
    }

    // Validate resolution length
    if (resolution && resolution.length > 300) {
      return NextResponse.json(
        { message: '다짐은 300자 이내로 작성해주세요.' },
        { status: 400 }
      );
    }

    // Validate interests
    if (interests && !Array.isArray(interests)) {
      return NextResponse.json(
        { message: '관심 분야는 배열 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // Update member profile
    await database
      .update(members)
      .set({
        profileImageUrl: profileImageUrl || null,
        bio: bio || null,
        interests: interests || null,
        resolution: resolution || null,
        updatedAt: new Date(),
      })
      .where(eq(members.id, userData.memberId));

    return NextResponse.json({
      message: '프로필이 수정되었습니다.',
    });
  } catch (error) {
    console.error('Profile edit API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
