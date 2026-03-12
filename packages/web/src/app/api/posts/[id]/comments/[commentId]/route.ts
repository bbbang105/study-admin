import { NextRequest } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { posts, postComments } = sharedDb;

/**
 * PATCH /api/posts/[id]/comments/[commentId]
 * 댓글 수정
 * - 인증 필요
 * - 본인 또는 관리자만 수정 가능
 * - deletedAt IS NULL인 댓글만 수정 가능
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { commentId } = await params;
    const database = getDb();

    const [existing] = await database
      .select({ memberId: postComments.memberId })
      .from(postComments)
      .where(and(eq(postComments.id, commentId), isNull(postComments.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('댓글을 찾을 수 없습니다.').toResponse();

    if (existing.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('수정 권한이 없습니다.').toResponse();
    }

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return Errors.badRequest('댓글 내용을 입력해주세요.').toResponse();
    }

    const [updated] = await database
      .update(postComments)
      .set({
        content: content.trim(),
        updatedAt: new Date(),
      })
      .where(eq(postComments.id, commentId))
      .returning();

    return successResponse(updated, '댓글이 수정되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/posts/[id]/comments/[commentId]
 * 댓글 소프트 삭제
 * - 인증 필요
 * - 본인 또는 관리자만 삭제 가능
 * - deletedAt 설정 (soft delete)
 * - posts.commentCount 감소 (최솟값 0)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId, commentId } = await params;
    const database = getDb();

    const [existing] = await database
      .select({ memberId: postComments.memberId })
      .from(postComments)
      .where(and(eq(postComments.id, commentId), isNull(postComments.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('댓글을 찾을 수 없습니다.').toResponse();

    if (existing.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('삭제 권한이 없습니다.').toResponse();
    }

    await database
      .update(postComments)
      .set({ deletedAt: new Date() })
      .where(eq(postComments.id, commentId));

    await database
      .update(posts)
      .set({ commentCount: sql`GREATEST(${posts.commentCount} - 1, 0)` })
      .where(eq(posts.id, postId));

    return successResponse(null, '댓글이 삭제되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
