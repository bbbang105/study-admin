import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { boardPolls, boardPollOptions, boardPollVotes, boardPosts } = sharedDb;

// DELETE - Delete poll
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId, pollId } = await params;
    const database = getDb();

    // Check if post exists and user is owner
    const [post] = await database
      .select({ memberId: boardPosts.memberId })
      .from(boardPosts)
      .where(eq(boardPosts.id, postId))
      .limit(1);

    if (!post) {
      return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();
    }

    if (post.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('투표 작성자만 삭제할 수 있습니다.').toResponse();
    }

    // Check if poll has votes
    const [voteCount] = await database
      .select({ count: boardPollVotes.id })
      .from(boardPollVotes)
      .where(eq(boardPollVotes.pollId, pollId));

    if (voteCount && (Number(voteCount.count) || 0) > 0) {
      return Errors.badRequest('투표 참여자가 있어 삭제할 수 없습니다.').toResponse();
    }

    // Delete poll (cascade will delete options)
    await database
      .update(boardPolls)
      .set({ deletedAt: new Date() })
      .where(eq(boardPolls.id, pollId));

    return successResponse(null, '투표가 삭제되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH - Update poll
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId, pollId } = await params;
    const body = await request.json();
    const { question, pollType, expiresAt, options } = body;

    const database = getDb();

    // Check if post exists and user is owner
    const [post] = await database
      .select({ memberId: boardPosts.memberId })
      .from(boardPosts)
      .where(eq(boardPosts.id, postId))
      .limit(1);

    if (!post) {
      return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();
    }

    if (post.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('투표 작성자만 수정할 수 있습니다.').toResponse();
    }

    // Check if poll has votes
    const [voteCount] = await database
      .select({ count: boardPollVotes.id })
      .from(boardPollVotes)
      .where(eq(boardPollVotes.pollId, pollId));

    if (voteCount && (Number(voteCount.count) || 0) > 0) {
      return Errors.badRequest('투표 참여자가 있어 수정할 수 없습니다.').toResponse();
    }

    // Update poll
    const [updatedPoll] = await database.transaction(async (tx) => {
      // Update poll metadata
      const [poll] = await tx
        .update(boardPolls)
        .set({
          ...(question && { question }),
          ...(pollType && { pollType }),
          ...(expiresAt && { expiresAt: new Date(expiresAt) }),
          updatedAt: new Date(),
        })
        .where(eq(boardPolls.id, pollId))
        .returning();

      if (!poll) {
        throw new Error('Failed to update poll');
      }

      // Update options if provided
      if (options && Array.isArray(options)) {
        // Delete existing options
        await tx
          .delete(boardPollOptions)
          .where(eq(boardPollOptions.pollId, pollId));

        // Insert new options
        if (options.length > 0) {
          await tx.insert(boardPollOptions).values(
            options.map((opt: { id: string; optionText: string }, idx: number) => ({
              pollId,
              optionText: opt.optionText,
              optionOrder: idx,
            }))
          );
        }
      }

      return [poll];
    });

    return successResponse(updatedPoll, '투표가 수정되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
