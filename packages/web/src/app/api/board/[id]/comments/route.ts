import { NextRequest } from 'next/server';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { successResponse, errorResponse, Errors } from '@/lib/api-error';
import { grantWebScore } from '@/lib/score';
import { sanitizeDescription } from '@/lib/sanitize';

const { boardPosts, boardComments, ActivityScoreType } = sharedDb;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const database = getDb();

    // Verify post exists (+ get post author for secret comment checks)
    const [post] = await database
      .select({ id: boardPosts.id, memberId: boardPosts.memberId })
      .from(boardPosts)
      .where(and(eq(boardPosts.id, postId), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!post) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();

    const body = await request.json();
    const { content, parentId } = body;
    let { isSecret } = body;

    if (!content?.trim()) {
      return Errors.badRequest('댓글 내용을 입력해주세요.').toResponse();
    }

    // Validate parentId + secret comment reply restrictions
    if (parentId) {
      const [parent] = await database
        .select({
          id: boardComments.id,
          memberId: boardComments.memberId,
          isSecret: boardComments.isSecret,
        })
        .from(boardComments)
        .where(and(
          eq(boardComments.id, parentId),
          eq(boardComments.postId, postId),
        ))
        .limit(1);

      if (!parent) return Errors.badRequest('상위 댓글을 찾을 수 없습니다.').toResponse();

      // 비밀댓글 답글: 댓글 작성자/글 작성자/관리자만 가능
      if (parent.isSecret) {
        const isCommentOwner = parent.memberId === auth.memberId;
        const isPostAuthor = post.memberId === auth.memberId;
        if (!isCommentOwner && !isPostAuthor && !auth.isAdmin) {
          return Errors.forbidden('비밀 댓글에는 작성자, 글 작성자, 관리자만 답글을 달 수 있습니다.').toResponse();
        }
        // 비밀댓글 대댓글은 강제 비밀
        isSecret = true;
      }
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

    // 게시판 댓글 활동 점수 (+2, 일일 상한 10)
    grantWebScore(
      auth.memberId,
      ActivityScoreType.BOARD_COMMENT,
      sanitizeDescription(`게시판 댓글: ${content.trim().slice(0, 50)}`),
    ).catch((err) => console.error('[score] grantWebScore failed:', err));

    return successResponse(newComment, '댓글이 작성되었습니다.', 201);
  } catch (error) {
    return errorResponse(error);
  }
}
