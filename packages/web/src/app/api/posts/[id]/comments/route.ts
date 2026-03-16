import { NextRequest } from 'next/server';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { getAdminDiscordIds } from '@/lib/admin';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { grantWebScore } from '@/lib/score';
import { sanitizeDescription } from '@/lib/sanitize';

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
      .select({ id: posts.id })
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
    if (parentId) {
      const [parent] = await database
        .select({ id: postComments.id })
        .from(postComments)
        .where(and(eq(postComments.id, parentId), eq(postComments.postId, postId), isNull(postComments.deletedAt)))
        .limit(1);
      if (!parent) return Errors.badRequest('상위 댓글을 찾을 수 없습니다.').toResponse();
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

    // 블로그 글 댓글 활동 점수 (+5, 일일 상한 20)
    grantWebScore(
      auth.memberId,
      ActivityScoreType.POST_COMMENT,
      sanitizeDescription(`포스트 댓글: ${content.trim().slice(0, 50)}`),
    ).catch((err) => console.error('[score] grantWebScore failed:', err));

    return successResponse(newComment, '댓글이 작성되었습니다.', 201);
  } catch (error) {
    return errorResponse(error);
  }
}
