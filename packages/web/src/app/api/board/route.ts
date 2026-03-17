import { NextRequest, after } from 'next/server';
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
import { sanitizeDescription, sanitizeTiptapContent } from '@/lib/sanitize';
import { grantWebScore } from '@/lib/score';
import { sendPushToMembers } from '@/lib/push';

const { boardPosts, members, boardPolls, boardPollOptions, ActivityScoreType, MemberStatus } = sharedDb;

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
    const pinnedPostsRaw =
      !category || category === 'notice'
        ? await database
            .select({
              ...selectFields,
              pollCount: count(boardPolls.id).mapWith(Number),
            })
            .from(boardPosts)
            .innerJoin(members, eq(boardPosts.memberId, members.id))
            .leftJoin(boardPolls, and(
              eq(boardPolls.postId, boardPosts.id),
              isNull(boardPolls.deletedAt)
            ))
            .where(and(isNull(boardPosts.deletedAt), eq(boardPosts.isPinned, true)))
            .groupBy(boardPosts.id, members.id)
            .orderBy(desc(boardPosts.createdAt))
        : [];

    // Normal posts (pinned excluded)
    const normalConditions = [...baseConditions, eq(boardPosts.isPinned, false)];

    const [countResult] = await database
      .select({ total: count() })
      .from(boardPosts)
      .where(and(...normalConditions));

    const normalPostsRaw = await database
      .select({
        ...selectFields,
        pollCount: count(boardPolls.id).mapWith(Number),
      })
      .from(boardPosts)
      .innerJoin(members, eq(boardPosts.memberId, members.id))
      .leftJoin(boardPolls, and(
        eq(boardPolls.postId, boardPosts.id),
        isNull(boardPolls.deletedAt)
      ))
      .where(and(...normalConditions))
      .groupBy(boardPosts.id, members.id)
      .orderBy(desc(boardPosts.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Admin discord IDs for badge display
    const adminDiscordIds = await getAdminDiscordIds();

    // Mask secret posts for non-owner non-admin
    const maskSecret = (post: (typeof normalPostsRaw)[number]) => {
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
          pollCount: 0,
        };
      }
      return {
        ...post,
        isMasked: false,
        memberIsAdmin: adminDiscordIds.includes(post.memberDiscordId),
      };
    };

    return successResponse({
      pinnedPosts: pinnedPostsRaw.map(maskSecret),
      posts: normalPostsRaw.map(maskSecret),
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
    const {
      category,
      title,
      content,
      contentText,
      isSecret,
      isNoticeBanner,
      polls,
    } = body;

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

    // Validate polls if provided
    if (polls && Array.isArray(polls) && polls.length > 0) {
      for (const poll of polls) {
        if (!poll.question?.trim()) {
          return Errors.badRequest('투표 질문을 입력해주세요.').toResponse();
        }
        if (!poll.pollType || !['text', 'date'].includes(poll.pollType)) {
          return Errors.badRequest('유효하지 않은 투표 유형입니다.').toResponse();
        }
        if (!poll.options || !Array.isArray(poll.options) || poll.options.length < 2) {
          return Errors.badRequest('선택지는 최소 2개 이상이어야 합니다.').toResponse();
        }
        if (poll.options.some((opt: string) => !opt.trim())) {
          return Errors.badRequest('모든 선택지에 내용을 입력해주세요.').toResponse();
        }
        if (!poll.expiresAt) {
          return Errors.badRequest('투표 마감시간을 설정해주세요.').toResponse();
        }
      }
    }

    const database = getDb();
    const bannerEnabled = category === 'notice' && Boolean(isNoticeBanner);

    const result = await database.transaction(async (tx) => {
      // If enabling banner, disable all existing banners first
      if (bannerEnabled) {
        await tx
          .update(boardPosts)
          .set({ isNoticeBanner: false })
          .where(eq(boardPosts.isNoticeBanner, true));
      }

      // Create post
      const createdPosts = await tx
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

      const post = createdPosts[0];

      if (!post) {
        throw new Error('Failed to create post');
      }

      // Create polls if provided
      if (polls && Array.isArray(polls) && polls.length > 0) {
        for (const poll of polls) {
          // Create poll
          const newPolls = await tx
            .insert(boardPolls)
            .values({
              postId: post.id,
              question: poll.question.trim(),
              pollType: poll.pollType,
              expiresAt: new Date(poll.expiresAt),
              allowMultiple: poll.allowMultiple || false,
              isAnonymous: poll.isAnonymous || false,
            })
            .returning();

          const newPoll = newPolls[0];

          if (!newPoll) {
            throw new Error('Failed to create poll');
          }

          // Create poll options
          await tx.insert(boardPollOptions).values(
            poll.options
              .filter((opt: string) => opt.trim())
              .map((opt: string, idx: number) => ({
                pollId: newPoll.id,
                optionText: opt.trim(),
                optionOrder: idx,
              }))
          );
        }
      }

      return post;
    });

    // 게시판 글 작성 활동 점수 (+10, 일일 상한 20)
    after(async () => {
      try {
        await grantWebScore(
          auth.memberId,
          ActivityScoreType.BOARD_POST,
          sanitizeDescription(title.trim().slice(0, 50))
        );
      } catch (err) {
        console.error('[score] grantWebScore failed:', err);
      }
    });

    // 공지사항인 경우 활성 멤버 전체에게 알림
    if (category === 'notice') {
      const activeMembers = await database
        .select({ id: members.id })
        .from(members)
        .where(eq(members.status, MemberStatus.ACTIVE));

      const memberIds = activeMembers.map((m) => m.id).filter((id) => id !== auth.memberId);
      after(async () => {
        try {
          await sendPushToMembers(memberIds, {
            title: '📢 새 공지사항',
            body: title.trim(),
            clickUrl: `/board/${result.id}`,
            data: { type: 'board_notice', postId: result.id },
          });
        } catch (err) {
          console.error('[push] Notice notification failed:', err);
        }
      });
    }

    return successResponse(result, '게시글이 작성되었습니다.', 201);
  } catch (error) {
    return errorResponse(error);
  }
}
