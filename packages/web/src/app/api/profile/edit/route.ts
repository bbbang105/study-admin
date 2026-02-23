import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';

const { members } = sharedDb;

/**
 * PUT /api/profile/edit
 * Supabase Auth → Discord ID → members 프로필 수정
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const discordIdentity = user.identities?.find(
      (identity) => identity.provider === 'discord'
    );
    const discordId = discordIdentity?.id as string | undefined;
    if (!discordId) {
      return NextResponse.json(
        { message: '스터디원 계정이 연결되어 있지 않습니다.' },
        { status: 400 }
      );
    }

    const database = db();
    const [memberData] = await database
      .select()
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!memberData) {
      return NextResponse.json(
        { message: '스터디원 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, nickname, part, profileImageUrl, bio, interests, resolution, githubUrl, linkedinUrl, instagramUrl } = body;

    if (part && (typeof part !== 'string' || part.length > 50)) {
      return NextResponse.json(
        { message: '파트는 50자 이내의 문자열이어야 합니다.' },
        { status: 400 }
      );
    }

    if (profileImageUrl) {
      try {
        const url = new URL(profileImageUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return NextResponse.json(
            { message: '프로필 이미지 URL은 http 또는 https만 허용됩니다.' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { message: '유효하지 않은 프로필 이미지 URL입니다.' },
          { status: 400 }
        );
      }
    }

    if (bio && typeof bio === 'string' && bio.trim().length < 100) {
      return NextResponse.json(
        { message: '자기소개는 100자 이상 작성해주세요.' },
        { status: 400 }
      );
    }

    if (bio && typeof bio === 'string' && bio.length > 200) {
      return NextResponse.json(
        { message: '자기소개는 200자 이내로 작성해주세요.' },
        { status: 400 }
      );
    }

    if (resolution && resolution.length > 300) {
      return NextResponse.json(
        { message: '다짐은 300자 이내로 작성해주세요.' },
        { status: 400 }
      );
    }

    if (interests) {
      if (!Array.isArray(interests) || interests.length > 20) {
        return NextResponse.json(
          { message: '관심 분야는 최대 20개까지 입력 가능합니다.' },
          { status: 400 }
        );
      }
      if (!interests.every((i: unknown) => typeof i === 'string' && i.length <= 50)) {
        return NextResponse.json(
          { message: '관심 분야는 각 50자 이내의 문자열이어야 합니다.' },
          { status: 400 }
        );
      }
    }

    await database
      .update(members)
      .set({
        ...(name && typeof name === 'string' && name.trim().length > 0 ? { name: name.trim() } : {}),
        ...(nickname && typeof nickname === 'string' && nickname.trim().length > 0 ? { nickname: nickname.trim() } : {}),
        ...(part ? { part } : {}),
        profileImageUrl: profileImageUrl || null,
        bio: bio || null,
        interests: interests || null,
        resolution: resolution || null,
        githubUrl: githubUrl || null,
        linkedinUrl: linkedinUrl || null,
        instagramUrl: instagramUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(members.id, memberData.id));

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
