import { NextRequest, after } from 'next/server';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { getAdminDiscordIds } from '@/lib/admin';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { grantWebScore } from '@/lib/score';
import { sanitizeDescription } from '@/lib/sanitize';
import { sendPushToMember } from '@/lib/push';

const { posts, postComments, members, ActivityScoreType } = sharedDb;

/**
 * GET /api/posts/[id]/comments
 * 블로그 글 댓글 목록 조회
 * - 인증 필요
 * - 삭제된 댓글도 포함 (isDeleted 플래그 + 내용 마스킹)
 * - 작성자 정보 + 관리자 여부 포함
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const database = getDb();

    const rows = await database
      .select({
        id: postComments.id,
        postId: postComments.postId,
        memberId: postComments.memberId,
        parentId: postComments.parentId,
        content: postComments.content,
        createdAt: postComments.createdAt,
        updatedAt: postComments.updatedAt,
        deletedAt: postComments.deletedAt,
        memberName: members.name,
        memberNickname: members.nickname,
        memberDiscordUsername: members.discordUsername,
        memberProfileImageUrl: members.profileImageUrl,
        memberDiscordId: members.discordId,
      })
      .from(postComments)
      .innerJoin(members, eq(postComments.memberId, members.id))
      .where(eq(postComments.postId, postId))
      .orderBy(asc(postComments.createdAt));

    const adminIds = await getAdminDiscordIds();

    const comments = rows.map((row) => {
      const isDeleted = row.deletedAt !== null;
      return {
        id: row.id,
        postId: row.postId,
        memberId: row.memberId,
        parentId: row.parentId,
        content: isDeleted ? '삭제된 댓글입니다.' : row.content,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        isDeleted,
        isOwner: !isDeleted && row.memberId === auth.memberId,
        member: {
          name: isDeleted ? '알 수 없음' : row.memberName,
          nickname: isDeleted ? null : row.memberNickname,
          discordUsername: isDeleted ? '' : row.memberDiscordUsername,
          profileImageUrl: isDeleted ? null : row.memberProfileImageUrl,
          discordId: isDeleted ? '' : row.memberDiscordId,
          isAdmin: isDeleted ? false : adminIds.includes(row.memberDiscordId),
        },
      };
    });

    return successResponse(comments);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/posts/[id]/comments
 * 블로그 글 댓글 작성
 * - 인증 필요
 * - 글 존재 여부 확인
 * - commentCount 증가
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const database = getDb();

    const [post] = await database
      .select({ id: posts.id, memberId: posts.memberId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) return Errors.notFound('글을 찾을 수 없습니다.').toResponse();

    const body = await request.json();
    const { content, parentId } = body;

    if (!content?.trim()) {
      return Errors.badRequest('댓글 내용을 입력해주세요.').toResponse();
    }

    // parentId 유효성 검증
    let parent: { id: string; memberId: string } | null = null;
    if (parentId) {
      const [parentData] = await database
        .select({ id: postComments.id, memberId: postComments.memberId })
        .from(postComments)
        .where(
          and(
            eq(postComments.id, parentId),
            eq(postComments.postId, postId),
            isNull(postComments.deletedAt)
          )
        )
        .limit(1);
      if (!parentData) return Errors.badRequest('상위 댓글을 찾을 수 없습니다.').toResponse();
      parent = parentData;
    }

    const [newComment] = await database
      .insert(postComments)
      .values({
        postId,
        memberId: auth.memberId,
        parentId: parentId || null,
        content: content.trim(),
      })
      .returning();

    await database
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1` })
      .where(eq(posts.id, postId));

    // 포스트 댓글 활동 점수 (+5, 일일 상한 20)
    // — 본인 글 제외, 같은 포스트에 이미 댓글 달았으면 제외 (포스트당 1회)
    if (post.memberId !== auth.memberId) {
      const priorComments = await database
        .select({ id: postComments.id })
        .from(postComments)
        .where(
          and(
            eq(postComments.postId, postId),
            eq(postComments.memberId, auth.memberId),
            isNull(postComments.deletedAt)
          )
        )
        .limit(2);

      // 방금 작성한 댓글 포함해서 1개뿐이면 = 첫 댓글 → 점수 부여
      if (priorComments.length <= 1) {
        after(async () => {
          try {
            await grantWebScore(
              auth.memberId,
              ActivityScoreType.POST_COMMENT,
              sanitizeDescription(content.trim().slice(0, 50))
            );
          } catch (err) {
            console.error('[score] grantWebScore failed:', err);
          }
        });
      }
    }

    // 1. 내가 쓴 포스트에 댓글이 달리면 알림 (본인 제외, 답글 대상자와 중복 시 생략)
    const isReplyToPostAuthor = parentId && parent && parent.memberId === post.memberId;
    if (post.memberId !== auth.memberId && !isReplyToPostAuthor) {
      after(async () => {
        try {
          await sendPushToMember(post.memberId, {
            title: '새 댓글이 달렸습니다',
            body: `${content.trim().slice(0, 50)}${content.length > 50 ? '...' : ''}`,
            clickUrl: `/posts/${postId}`,
            data: { type: 'post_comment', postId, commentId: newComment?.id ?? '' },
          });
        } catch (err) {
          console.error('[push] Post comment notification failed:', err);
        }
      });
    }

    // 2. 대댓글의 경우 원댓글 작성자에게도 알림
    if (parentId && parent) {
      const pmid = parent.memberId;
      const amid = auth.memberId;

      // 내 댓글에 답글이 달리면 알림 (작성자 본인 제외)
      if (pmid !== amid) {
        after(async () => {
          try {
            await sendPushToMember(pmid, {
              title: '💬 답글이 달렸습니다',
              body: `${content.trim().slice(0, 50)}${content.length > 50 ? '...' : ''}`,
              clickUrl: `/posts/${postId}`,
              data: { type: 'post_reply', postId, commentId: newComment?.id ?? '' },
            });
          } catch (err) {
            console.error('[push] Post reply notification failed:', err);
          }
        });
      }
    }

    return successResponse(newComment, '댓글이 작성되었습니다.', 201);
  } catch (error) {
    return errorResponse(error);
  }
}
