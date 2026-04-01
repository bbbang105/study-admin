import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { REACTION_EMOJIS } = sharedDb;
type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

const { boardPostReactions, boardPosts } = sharedDb;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const body = await request.json();
    const { emoji } = body as { emoji: string };

    // Validate emoji
    if (!emoji || !REACTION_EMOJIS.includes(emoji as ReactionEmoji)) {
      return Errors.badRequest('유효하지 않은 이모지입니다.').toResponse();
    }

    const database = getDb();

    // Check post exists
    const [post] = await database
      .select({ id: boardPosts.id })
      .from(boardPosts)
      .where(and(eq(boardPosts.id, postId), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!post) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();

    // Toggle in transaction to avoid race condition
    const action = await database.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: boardPostReactions.id })
        .from(boardPostReactions)
        .where(
          and(
            eq(boardPostReactions.postId, postId),
            eq(boardPostReactions.memberId, auth.memberId),
            eq(boardPostReactions.emoji, emoji)
          )
        )
        .limit(1);

      if (existing) {
        await tx
          .delete(boardPostReactions)
          .where(eq(boardPostReactions.id, existing.id));
        return 'removed' as const;
      } else {
        await tx
          .insert(boardPostReactions)
          .values({ postId, memberId: auth.memberId, emoji });
        return 'added' as const;
      }
    });

    return successResponse(
      { action, emoji },
      undefined,
      action === 'added' ? 201 : 200
    );
  } catch (error) {
    return errorResponse(error);
  }
}
