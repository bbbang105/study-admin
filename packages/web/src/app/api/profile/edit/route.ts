import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { members } = sharedDb;

/**
 * PUT /api/profile/edit
 * Supabase Auth → Discord ID → members 프로필 수정
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return Errors.unauthorized().toResponse();
    }

    const discordIdentity = user.identities?.find((identity) => identity.provider === 'discord');
    const discordId = discordIdentity?.id as string | undefined;
    if (!discordId) {
      return Errors.badRequest('스터디원 계정이 연결되어 있지 않습니다.').toResponse();
    }

    const database = db();
    const [memberData] = await database
      .select()
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!memberData) {
      return Errors.notFound('스터디원 정보를 찾을 수 없습니다.').toResponse();
    }

    const body = await request.json();
    const {
      name,
      nickname,
      part,
      profileImageUrl,
      bio,
      interests,
      resolution,
      githubUrl,
      linkedinUrl,
      instagramUrl,
      rssConsent,
    } = body;

    if (part && (typeof part !== 'string' || part.length > 50)) {
      return Errors.badRequest('파트는 50자 이내의 문자열이어야 합니다.').toResponse();
    }

    if (profileImageUrl) {
      try {
        const url = new URL(profileImageUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return Errors.badRequest(
            '프로필 이미지 URL은 http 또는 https만 허용됩니다.'
          ).toResponse();
        }
      } catch {
        return Errors.badRequest('유효하지 않은 프로필 이미지 URL입니다.').toResponse();
      }
    }

    if (bio && typeof bio === 'string' && bio.trim().length < 100) {
      return Errors.badRequest('자기소개는 100자 이상 작성해주세요.').toResponse();
    }

    if (bio && typeof bio === 'string' && bio.length > 200) {
      return Errors.badRequest('자기소개는 200자 이내로 작성해주세요.').toResponse();
    }

    if (resolution && resolution.length > 300) {
      return Errors.badRequest('다짐은 300자 이내로 작성해주세요.').toResponse();
    }

    if (interests) {
      if (!Array.isArray(interests) || interests.length > 20) {
        return Errors.badRequest('관심 분야는 최대 20개까지 입력 가능합니다.').toResponse();
      }
      if (!interests.every((i: unknown) => typeof i === 'string' && i.length <= 50)) {
        return Errors.badRequest('관심 분야는 각 50자 이내의 문자열이어야 합니다.').toResponse();
      }
    }

    await database
      .update(members)
      .set({
        ...(name && typeof name === 'string' && name.trim().length > 0
          ? { name: name.trim() }
          : {}),
        ...(nickname && typeof nickname === 'string' && nickname.trim().length > 0
          ? { nickname: nickname.trim() }
          : {}),
        ...(part ? { part } : {}),
        profileImageUrl: profileImageUrl || null,
        bio: bio || null,
        interests: interests || null,
        resolution: resolution || null,
        githubUrl: githubUrl || null,
        linkedinUrl: linkedinUrl || null,
        instagramUrl: instagramUrl || null,
        ...(typeof rssConsent === 'boolean' ? { rssConsent } : {}),
        updatedAt: new Date(),
      })
      .where(eq(members.id, memberData.id));

    return successResponse(null, '프로필이 수정되었습니다.');
  } catch (error) {
    console.error('Profile edit API error:', error);
    return errorResponse(error);
  }
}
