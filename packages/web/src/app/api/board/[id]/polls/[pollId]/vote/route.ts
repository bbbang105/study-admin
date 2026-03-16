import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { boardPolls, boardPollVotes, boardPollOptions } = sharedDb;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { pollId } = await params;
    const body = await request.json();
    const { optionIds } = body;

    // Validation
    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return Errors.badRequest('선택지를 선택해주세요.').toResponse();
    }

    const database = getDb();

    // Fetch poll with options
    const polls = await database
      .select({
        id: boardPolls.id,
        pollType: boardPolls.pollType,
        expiresAt: boardPolls.expiresAt,
      })
      .from(boardPolls)
      .where(eq(boardPolls.id, pollId))
      .limit(1);

    const poll = polls[0];

    if (!poll) {
      return Errors.notFound('투표를 찾을 수 없습니다.').toResponse();
    }

    // Check if expired
    if (new Date(poll.expiresAt) < new Date()) {
      return Errors.badRequest('마감된 투표입니다.').toResponse();
    }

    // Validate option IDs belong to this poll
    const options = await database
      .select({ id: boardPollOptions.id })
      .from(boardPollOptions)
      .where(eq(boardPollOptions.pollId, pollId));

    const validOptionIds = options.map((opt) => opt.id);
    const invalidOptions = optionIds.filter(
      (id: string) => !validOptionIds.includes(id)
    );

    if (invalidOptions.length > 0) {
      return Errors.badRequest('유효하지 않은 선택지입니다.').toResponse();
    }

    // Validate poll type constraints
    if (poll.pollType === 'single' && optionIds.length > 1) {
      return Errors.badRequest('단일 선택 투표는 1개만 선택할 수 있습니다.').toResponse();
    }

    // For single/multiple/date votes, delete existing votes first (allow changing)
    // Use transaction to prevent race conditions
    if (poll.pollType === 'single' || poll.pollType === 'multiple' || poll.pollType === 'date') {
      await database.transaction(async (tx) => {
        await tx
          .delete(boardPollVotes)
          .where(
            and(
              eq(boardPollVotes.pollId, pollId),
              eq(boardPollVotes.memberId, auth.memberId)
            )
          );

        // Insert new votes
        const votesToInsert = optionIds.map((optionId: string) => ({
          pollId,
          optionId,
          memberId: poll.pollType === 'anonymous' ? null : auth.memberId,
          anonymousId: poll.pollType === 'anonymous' ? crypto.randomUUID() : null,
        }));

        await tx.insert(boardPollVotes).values(votesToInsert);
      });
    } else {
      // 익명 투표는 기존 투표 유지 (중복 투표 허용)
      const votesToInsert = optionIds.map((optionId: string) => ({
        pollId,
        optionId,
        memberId: null,
        anonymousId: crypto.randomUUID(),
      }));

      await database.insert(boardPollVotes).values(votesToInsert);
    }

    return successResponse({ success: true }, '투표가 완료되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
