import { NextRequest } from 'next/server';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import {
  createPaginationMeta,
  errorResponse,
  Errors,
  parsePagination,
  successResponse,
} from '@/lib/api-error';
import { getAdminDiscordIds } from '@/lib/admin';
import { isValidCategory } from '@/lib/board-config';
import { sanitizeTiptapContent } from '@/lib/sanitize';

const { boardPosts, members } = sharedDb;

export async function GET(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');
    const { page, pageSize, offset } = parsePagination(searchParams);

    const database = getDb();

    // Base conditions: soft delete excluded
    const baseConditions = [isNull(boardPosts.deletedAt)];
    if (category) {
      baseConditions.push(eq(boardPosts.category, category));
    }

    const selectFields = {
      id: boardPosts.id,
      memberId: boardPosts.memberId,
      memberName: members.nickname,
      memberProfileImage: members.profileImageUrl,
      memberDiscordId: members.discordId,
      category: boardPosts.category,
      title: boardPosts.title,
      contentText: boardPosts.contentText,
      isSecret: boardPosts.isSecret,
      isPinned: boardPosts.isPinned,
      commentCount: boardPosts.commentCount,
      createdAt: boardPosts.createdAt,
    };

    // Pinned notices (when no category filter, or filtering by notice)
    const pinnedPosts =
      !category || category === 'notice'
        ? await database
            .select(selectFields)
            .from(boardPosts)
            .innerJoin(members, eq(boardPosts.memberId, members.id))
            .where(and(isNull(boardPosts.deletedAt), eq(boardPosts.isPinned, true)))
            .orderBy(desc(boardPosts.createdAt))
        : [];

    // Normal posts (pinned excluded)
    const normalConditions = [...baseConditions, eq(boardPosts.isPinned, false)];

    const [countResult] = await database
      .select({ total: count() })
      .from(boardPosts)
      .where(and(...normalConditions));

    const normalPosts = await database
      .select(selectFields)
      .from(boardPosts)
      .innerJoin(members, eq(boardPosts.memberId, members.id))
      .where(and(...normalConditions))
      .orderBy(desc(boardPosts.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Admin discord IDs for badge display
    const adminDiscordIds = await getAdminDiscordIds();

    // Mask secret posts for non-owner non-admin
    const maskSecret = (post: (typeof normalPosts)[number]) => {
      if (post.isSecret && post.memberId !== auth.memberId && !auth.isAdmin) {
        return {
          ...post,
          title: '비밀글입니다',
          contentText: '',
          memberName: '익명',
          memberProfileImage: null,
          memberDiscordId: '',
          isMasked: true,
          memberIsAdmin: false,
        };
      }
      return {
        ...post,
        isMasked: false,
        memberIsAdmin: adminDiscordIds.includes(post.memberDiscordId),
      };
    };

    return successResponse({
      pinnedPosts: pinnedPosts.map(maskSecret),
      posts: normalPosts.map(maskSecret),
      pagination: createPaginationMeta(page, pageSize, countResult?.total ?? 0),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const body = await request.json();
    const { category, title, content, contentText, isSecret, isNoticeBanner } = body;

    // Validation
    if (!category || !title?.trim() || !content || !contentText?.trim()) {
      return Errors.badRequest('필수 항목을 입력해주세요.').toResponse();
    }

    if (!isValidCategory(category)) {
      return Errors.badRequest('유효하지 않은 카테고리입니다.').toResponse();
    }

    // Only admins can create notices or set banner
    if ((category === 'notice' || isNoticeBanner) && !auth.isAdmin) {
      return Errors.forbidden('공지는 관리자만 작성할 수 있습니다.').toResponse();
    }

    const database = getDb();
    const bannerEnabled = category === 'notice' && Boolean(isNoticeBanner);

    const [newPost] = await database.transaction(async (tx) => {
      // If enabling banner, disable all existing banners first
      if (bannerEnabled) {
        await tx
          .update(boardPosts)
          .set({ isNoticeBanner: false })
          .where(eq(boardPosts.isNoticeBanner, true));
      }

      return tx
        .insert(boardPosts)
        .values({
          memberId: auth.memberId,
          category,
          title: title.trim(),
          content: sanitizeTiptapContent(content),
          contentText: contentText.trim(),
          isSecret: isSecret || false,
          isPinned: category === 'notice',
          isNoticeBanner: bannerEnabled,
        })
        .returning();
    });

    return successResponse(newPost, '게시글이 작성되었습니다.', 201);
  } catch (error) {
    return errorResponse(error);
  }
}
