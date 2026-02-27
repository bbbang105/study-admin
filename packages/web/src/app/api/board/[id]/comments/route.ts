import { NextRequest } from 'next/server';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { successResponse, errorResponse, Errors } from '@/lib/api-error';

const { boardPosts, boardComments } = sharedDb;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const database = getDb();

    // Verify post exists
    const [post] = await database
      .select({ id: boardPosts.id })
      .from(boardPosts)
      .where(and(eq(boardPosts.id, postId), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!post) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();

    const body = await request.json();
    const { content, parentId, isSecret } = body;

    if (!content?.trim()) {
      return Errors.badRequest('댓글 내용을 입력해주세요.').toResponse();
    }

    // Validate parentId if provided
    if (parentId) {
      const [parent] = await database
        .select({ id: boardComments.id })
        .from(boardComments)
        .where(and(
          eq(boardComments.id, parentId),
          eq(boardComments.postId, postId),
        ))
        .limit(1);

      if (!parent) return Errors.badRequest('상위 댓글을 찾을 수 없습니다.').toResponse();
    }

    const [newComment] = await database
      .insert(boardComments)
      .values({
        postId,
        memberId: auth.memberId,
        parentId: parentId || null,
        content: content.trim(),
        isSecret: isSecret || false,
      })
      .returning();

    // Increment comment_count
    await database
      .update(boardPosts)
      .set({ commentCount: sql`${boardPosts.commentCount} + 1` })
      .where(eq(boardPosts.id, postId));

    return successResponse(newComment, '댓글이 작성되었습니다.', 201);
  } catch (error) {
    return errorResponse(error);
  }
}
