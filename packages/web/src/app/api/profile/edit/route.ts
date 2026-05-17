import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { isSafeUrl } from '@/lib/rss-detect';
import { syncMemberBlogs, validateBlogInputs } from '@/lib/member-blogs';

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
      blogs,
      profileImageUrl,
      bio,
      interests,
      resolution,
      githubUrl,
      linkedinUrl,
      instagramUrl,
    } = body;

    // --- 검증 ---

    if (name && (typeof name !== 'string' || name.trim().length > 50)) {
      return Errors.badRequest('이름은 50자 이내여야 합니다.').toResponse();
    }

    if (nickname && (typeof nickname !== 'string' || nickname.trim().length > 100)) {
      return Errors.badRequest('닉네임은 100자 이내여야 합니다.').toResponse();
    }

    if (part && (typeof part !== 'string' || part.length > 50)) {
      return Errors.badRequest('파트는 50자 이내의 문자열이어야 합니다.').toResponse();
    }

    // 블로그 목록 검증 (1~MAX개, 각 SSRF 체크, 이름 길이)
    const blogValidation = validateBlogInputs(blogs, true);
    if (!blogValidation.ok) {
      return Errors.badRequest(blogValidation.message).toResponse();
    }

    // 프로필 이미지 URL 검증 (SSRF 방지)
    if (profileImageUrl && !isSafeUrl(profileImageUrl)) {
      return Errors.badRequest('유효하지 않은 프로필 이미지 URL입니다.').toResponse();
    }

    // 소셜 URL 검증 (SSRF 방지)
    const socialUrls = { githubUrl, linkedinUrl, instagramUrl };
    for (const [key, value] of Object.entries(socialUrls)) {
      if (value && typeof value === 'string' && value.trim().length > 0) {
        if (value.length > 500) {
          return Errors.badRequest(`${key}은 500자 이내여야 합니다.`).toResponse();
        }
        if (!isSafeUrl(value)) {
          return Errors.badRequest(`유효하지 않은 ${key}입니다.`).toResponse();
        }
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

    // --- DB 업데이트 ---

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
        updatedAt: new Date(),
      })
      .where(eq(members.id, memberData.id));

    // 블로그 동기화 (추가/수정/삭제 + 변경분 RSS 비동기 재감지)
    await syncMemberBlogs(memberData.id, blogValidation.value);

    return successResponse(null, '프로필이 수정되었습니다.');
  } catch (error) {
    console.error('Profile edit API error:', error);
    return errorResponse(error);
  }
}
