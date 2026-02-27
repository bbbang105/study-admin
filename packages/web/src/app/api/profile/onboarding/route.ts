import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';

const { members } = sharedDb;

/**
 * POST /api/profile/onboarding
 * Supabase Auth → Discord ID → 온보딩 완료
 * 신규 유저: INSERT, 기존 유저: UPDATE (upsert on discordId)
 */
export async function POST(request: NextRequest) {
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
        { message: 'Discord 계정이 연결되어 있지 않습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, nickname, part, blogUrl, profileImageUrl, bio, interests, resolution, githubUrl, linkedinUrl, instagramUrl, rssConsent } = body;

    // 필수 필드 검증
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { message: '이름(실명)은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      return NextResponse.json(
        { message: '닉네임은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!part || typeof part !== 'string') {
      return NextResponse.json(
        { message: '파트는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!blogUrl || typeof blogUrl !== 'string') {
      return NextResponse.json(
        { message: '블로그 URL은 필수입니다.' },
        { status: 400 }
      );
    }

    // 블로그 URL 검증
    try {
      const url = new URL(blogUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return NextResponse.json(
          { message: '블로그 URL은 http 또는 https만 허용됩니다.' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { message: '유효하지 않은 블로그 URL입니다.' },
        { status: 400 }
      );
    }

    if (!bio || typeof bio !== 'string' || bio.trim().length < 100) {
      return NextResponse.json(
        { message: '자기소개는 100자 이상 작성해주세요.' },
        { status: 400 }
      );
    }

    if (!interests || !Array.isArray(interests) || interests.length < 1) {
      return NextResponse.json(
        { message: '관심사를 1개 이상 선택해주세요.' },
        { status: 400 }
      );
    }

    if (interests.length > 6) {
      return NextResponse.json(
        { message: '관심사는 최대 6개까지 선택 가능합니다.' },
        { status: 400 }
      );
    }

    if (!interests.every((i: unknown) => typeof i === 'string' && i.length <= 50)) {
      return NextResponse.json(
        { message: '관심사는 각 50자 이내의 문자열이어야 합니다.' },
        { status: 400 }
      );
    }

    if (!resolution || typeof resolution !== 'string' || resolution.trim().length === 0) {
      return NextResponse.json(
        { message: '다짐은 필수입니다.' },
        { status: 400 }
      );
    }

    // 프로필 이미지 URL 검증 (선택)
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

    const database = db();
    const rawUsername = user.user_metadata?.name || user.user_metadata?.full_name || '';
    // Discord 새 유저네임 시스템에서 discriminator가 0이면 #0 제거
    const discordUsername = rawUsername.replace(/#0$/, '');

    // 기존 멤버 조회
    const [existingMember] = await database
      .select()
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (existingMember) {
      // 기존 유저: UPDATE
      await database
        .update(members)
        .set({
          name: name.trim(),
          nickname: nickname.trim(),
          part,
          blogUrl,
          profileImageUrl: profileImageUrl || null,
          bio: bio.trim(),
          interests,
          resolution: resolution.trim(),
          githubUrl: githubUrl || null,
          linkedinUrl: linkedinUrl || null,
          instagramUrl: instagramUrl || null,
          rssConsent: rssConsent !== false,
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(members.id, existingMember.id));
    } else {
      // 신규 유저: INSERT
      await database
        .insert(members)
        .values({
          discordId,
          discordUsername,
          name: name.trim(),
          nickname: nickname.trim(),
          part,
          blogUrl,
          profileImageUrl: profileImageUrl || null,
          bio: bio.trim(),
          interests,
          resolution: resolution.trim(),
          githubUrl: githubUrl || null,
          linkedinUrl: linkedinUrl || null,
          instagramUrl: instagramUrl || null,
          rssConsent: rssConsent !== false,
          onboardingCompleted: true,
          status: 'pending_approval',
        });
    }

    return NextResponse.json({
      message: '온보딩이 완료되었습니다.',
    });
  } catch (error) {
    console.error('Onboarding API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
