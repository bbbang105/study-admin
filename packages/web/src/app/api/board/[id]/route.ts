import { NextRequest } from 'next/server';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { successResponse, errorResponse, Errors } from '@/lib/api-error';

const { boardPosts, boardComments, members } = sharedDb;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id } = await params;
    const database = getDb();

    const [post] = await database
      .select({
        id: boardPosts.id,
        memberId: boardPosts.memberId,
        memberName: members.nickname,
        memberProfileImage: members.profileImageUrl,
        memberDiscordId: members.discordId,
        category: boardPosts.category,
        title: boardPosts.title,
        content: boardPosts.content,
        contentText: boardPosts.contentText,
        isSecret: boardPosts.isSecret,
        isPinned: boardPosts.isPinned,
        commentCount: boardPosts.commentCount,
        createdAt: boardPosts.createdAt,
        updatedAt: boardPosts.updatedAt,
      })
      .from(boardPosts)
      .innerJoin(members, eq(boardPosts.memberId, members.id))
      .where(and(eq(boardPosts.id, id), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!post) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();

    // Secret post access check
    if (post.isSecret && post.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('비밀글은 작성자와 관리자만 볼 수 있습니다.').toResponse();
    }

    // Comments (flat list, client converts to tree)
    const comments = await database
      .select({
        id: boardComments.id,
        postId: boardComments.postId,
        memberId: boardComments.memberId,
        memberName: members.nickname,
        memberProfileImage: members.profileImageUrl,
        memberDiscordId: members.discordId,
        parentId: boardComments.parentId,
        content: boardComments.content,
        isSecret: boardComments.isSecret,
        createdAt: boardComments.createdAt,
        updatedAt: boardComments.updatedAt,
        deletedAt: boardComments.deletedAt,
      })
      .from(boardComments)
      .innerJoin(members, eq(boardComments.memberId, members.id))
      .where(eq(boardComments.postId, id))
      .orderBy(asc(boardComments.createdAt));

    // Mask secret/deleted comments
    const maskedComments = comments.map((comment) => {
      if (comment.deletedAt) {
        return {
          ...comment,
          content: '삭제된 댓글입니다.',
          memberName: '',
          memberProfileImage: null,
          memberDiscordId: '',
          isDeleted: true,
          isMasked: false,
        };
      }
      if (
        comment.isSecret &&
        comment.memberId !== auth.memberId &&
        post.memberId !== auth.memberId &&
        !auth.isAdmin
      ) {
        return {
          ...comment,
          content: '비밀 댓글입니다.',
          memberName: '익명',
          memberProfileImage: null,
          memberDiscordId: '',
          isDeleted: false,
          isMasked: true,
        };
      }
      return { ...comment, isDeleted: false, isMasked: false };
    });

    return successResponse({ post, comments: maskedComments });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id } = await params;
    const database = getDb();

    const [existing] = await database
      .select({ memberId: boardPosts.memberId, category: boardPosts.category })
      .from(boardPosts)
      .where(and(eq(boardPosts.id, id), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();
    if (existing.memberId !== auth.memberId) {
      return Errors.forbidden('본인의 글만 수정할 수 있습니다.').toResponse();
    }

    const body = await request.json();
    const { category, title, content, contentText, isSecret } = body;

    if (category === 'notice' && !auth.isAdmin) {
      return Errors.forbidden('공지는 관리자만 작성할 수 있습니다.').toResponse();
    }

    const [updated] = await database
      .update(boardPosts)
      .set({
        ...(category && { category }),
        ...(title && { title: title.trim() }),
        ...(content && { content }),
        ...(contentText && { contentText: contentText.trim() }),
        ...(isSecret !== undefined && { isSecret }),
        isPinned: (category || existing.category) === 'notice',
        updatedAt: new Date(),
      })
      .where(eq(boardPosts.id, id))
      .returning();

    return successResponse(updated, '게시글이 수정되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id } = await params;
    const database = getDb();

    const [existing] = await database
      .select({ memberId: boardPosts.memberId })
      .from(boardPosts)
      .where(and(eq(boardPosts.id, id), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();
    if (existing.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('삭제 권한이 없습니다.').toResponse();
    }

    await database
      .update(boardPosts)
      .set({ deletedAt: new Date() })
      .where(eq(boardPosts.id, id));

    return successResponse(null, '게시글이 삭제되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
