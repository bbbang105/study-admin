import { NextRequest } from 'next/server';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { successResponse, errorResponse, Errors } from '@/lib/api-error';

const { boardPosts, boardComments } = sharedDb;

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
      .select({ memberId: boardComments.memberId })
      .from(boardComments)
      .where(and(eq(boardComments.id, commentId), isNull(boardComments.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('댓글을 찾을 수 없습니다.').toResponse();
    if (existing.memberId !== auth.memberId) {
      return Errors.forbidden('본인의 댓글만 수정할 수 있습니다.').toResponse();
    }

    const body = await request.json();
    const { content, isSecret } = body;

    if (!content?.trim()) {
      return Errors.badRequest('댓글 내용을 입력해주세요.').toResponse();
    }

    const [updated] = await database
      .update(boardComments)
      .set({
        content: content.trim(),
        ...(isSecret !== undefined && { isSecret }),
        updatedAt: new Date(),
      })
      .where(eq(boardComments.id, commentId))
      .returning();

    return successResponse(updated, '댓글이 수정되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId, commentId } = await params;
    const database = getDb();

    const [existing] = await database
      .select({ memberId: boardComments.memberId })
      .from(boardComments)
      .where(and(eq(boardComments.id, commentId), isNull(boardComments.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('댓글을 찾을 수 없습니다.').toResponse();
    if (existing.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('삭제 권한이 없습니다.').toResponse();
    }

    // Soft delete
    await database
      .update(boardComments)
      .set({ deletedAt: new Date() })
      .where(eq(boardComments.id, commentId));

    // Decrement comment_count
    await database
      .update(boardPosts)
      .set({ commentCount: sql`GREATEST(${boardPosts.commentCount} - 1, 0)` })
      .where(eq(boardPosts.id, postId));

    return successResponse(null, '댓글이 삭제되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
