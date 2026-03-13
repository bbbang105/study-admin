import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { boardPolls, boardPollOptions, boardPosts } = sharedDb;

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string; pollId: string } }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { postId, pollId } = params;
    const body = await request.json();
    const { optionText } = body;

    // Validation
    if (!optionText || !optionText.trim()) {
      return Errors.badRequest('선택지 내용을 입력해주세요.').toResponse();
    }

    const database = getDb();

    // Fetch poll and check permissions
    const [poll] = await database
      .select({
        id: boardPolls.id,
        postId: boardPolls.postId,
        allowAddOption: boardPolls.allowAddOption,
        expiresAt: boardPolls.expiresAt,
      })
      .from(boardPolls)
      .where(eq(boardPolls.id, pollId))
      .limit(1);

    if (!poll) {
      return Errors.notFound('투표를 찾을 수 없습니다.').toResponse();
    }

    // Check if adding options is allowed
    if (!poll.allowAddOption) {
      return Errors.forbidden('선택지 추가가 허용되지 않는 투표입니다.').toResponse();
    }

    // Check if expired
    if (new Date(poll.expiresAt) < new Date()) {
      return Errors.badRequest('마감된 투표입니다.').toResponse();
    }

    // Check if user is the post author
    const [post] = await database
      .select({ memberId: boardPosts.memberId })
      .from(boardPosts)
      .where(eq(boardPosts.id, postId))
      .limit(1);

    if (!post) {
      return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();
    }

    if (post.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('작성자만 선택지를 추가할 수 있습니다.').toResponse();
    }

    // Get current max order
    const [maxOrder] = await database
      .select({ maxOrder: boardPollOptions.optionOrder })
      .from(boardPollOptions)
      .where(eq(boardPollOptions.pollId, pollId))
      .orderBy(boardPollOptions.optionOrder)
      .limit(1);

    const newOrder = (maxOrder?.maxOrder ?? -1) + 1;

    // Insert new option
    const [newOption] = await database
      .insert(boardPollOptions)
      .values({
        pollId,
        optionText: optionText.trim(),
        optionOrder: newOrder,
      })
      .returning();

    return successResponse(newOption, '선택지가 추가되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
