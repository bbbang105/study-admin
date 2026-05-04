import { after, NextRequest } from 'next/server';
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
 * - 비밀댓글: 작성자/포스트작성자/관리자만 열람 가능
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const database = getDb();

    // 포스트 작성자 조회 (비밀댓글 열람 권한 체크용)
    const [post] = await database
      .select({ memberId: posts.memberId })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .limit(1);

    const rows = await database
      .select({
        id: postComments.id,
        postId: postComments.postId,
        memberId: postComments.memberId,
        parentId: postComments.parentId,
        content: postComments.content,
        isSecret: postComments.isSecret,
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

      if (isDeleted) {
        return {
          id: row.id,
          postId: row.postId,
          memberId: row.memberId,
          parentId: row.parentId,
          content: '삭제된 댓글입니다.',
          isSecret: row.isSecret ?? false,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          isDeleted: true,
          isMasked: false,
          isOwner: false,
          member: {
            name: '알 수 없음',
            nickname: null,
            discordUsername: '',
            profileImageUrl: null,
            discordId: '',
            isAdmin: false,
          },
        };
      }

      // 비밀댓글 마스킹: 작성자/포스트작성자/부모댓글작성자/관리자가 아니면 내용 숨김
      const isSecretComment = row.isSecret ?? false;
      const parentComment = row.parentId ? rows.find((r) => r.id === row.parentId) : null;
      const shouldMask =
        isSecretComment &&
        row.memberId !== auth.memberId &&
        post?.memberId !== auth.memberId &&
        parentComment?.memberId !== auth.memberId &&
        !auth.isAdmin;

      if (shouldMask) {
        return {
          id: row.id,
          postId: row.postId,
          memberId: row.memberId,
          parentId: row.parentId,
          content: '비밀 댓글입니다.',
          isSecret: true,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          isDeleted: false,
          isMasked: true,
          isOwner: false,
          member: {
            name: '익명',
            nickname: null,
            discordUsername: '',
            profileImageUrl: null,
            discordId: '',
            isAdmin: false,
          },
        };
      }

      return {
        id: row.id,
        postId: row.postId,
        memberId: row.memberId,
        parentId: row.parentId,
        content: row.content,
        isSecret: isSecretComment,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        isDeleted: false,
        isMasked: false,
        isOwner: row.memberId === auth.memberId,
        member: {
          name: row.memberName,
          nickname: row.memberNickname,
          discordUsername: row.memberDiscordUsername,
          profileImageUrl: row.memberProfileImageUrl,
          discordId: row.memberDiscordId,
          isAdmin: adminIds.includes(row.memberDiscordId),
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
 * - 비밀댓글 지원 (isSecret)
 * - 비밀댓글 답글 제한: 작성자/포스트작성자/관리자만
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
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .limit(1);

    if (!post) return Errors.notFound('글을 찾을 수 없습니다.').toResponse();

    const body = await request.json();
    const { content, parentId } = body;
    let { isSecret } = body;

    if (!content?.trim()) {
      return Errors.badRequest('댓글 내용을 입력해주세요.').toResponse();
    }

    if (content.trim().length > 5000) {
      return Errors.badRequest('댓글은 5000자를 초과할 수 없습니다.').toResponse();
    }

    // parentId 유효성 검증 + 비밀댓글 답글 제한
    let parent: { id: string; memberId: string; isSecret: boolean | null } | null = null;
    if (parentId) {
      const [parentData] = await database
        .select({
          id: postComments.id,
          memberId: postComments.memberId,
          isSecret: postComments.isSecret,
        })
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

      // 비밀댓글 답글: 작성자/포스트작성자/관리자만 가능 + 자동 비밀 처리
      if (parent.isSecret) {
        if (parent.memberId !== auth.memberId && post.memberId !== auth.memberId && !auth.isAdmin) {
          return Errors.forbidden(
            '비밀 댓글에는 작성자, 글 작성자, 관리자만 답글을 달 수 있습니다.'
          ).toResponse();
        }
        isSecret = true;
      }
    }

    const [newComment] = await database
      .insert(postComments)
      .values({
        postId,
        memberId: auth.memberId,
        parentId: parentId || null,
        content: sanitizeDescription(content.trim()),
        isSecret: isSecret || false,
      })
      .returning();

    await database
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1` })
      .where(eq(posts.id, postId));

    // 포스트 댓글 활동 점수
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

    // 푸시 알림: 비밀댓글이면 내용 마스킹
    const notificationBody =
      isSecret || false
        ? '비밀 댓글이 달렸습니다.'
        : `${content.trim().slice(0, 50)}${content.length > 50 ? '...' : ''}`;

    // 1. 포스트 작성자 알림 (본인 제외, 답글 대상자와 중복 시 생략)
    const isReplyToPostAuthor = parentId && parent && parent.memberId === post.memberId;
    if (post.memberId !== auth.memberId && !isReplyToPostAuthor) {
      after(async () => {
        try {
          await sendPushToMember(post.memberId, {
            title: '새 댓글이 달렸습니다',
            body: notificationBody,
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

      if (pmid !== amid) {
        after(async () => {
          try {
            await sendPushToMember(pmid, {
              title: '💬 답글이 달렸습니다',
              body: notificationBody,
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
