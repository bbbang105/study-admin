import { NextRequest } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import {
  errorResponse,
  Errors,
  successResponse,
  withCache,
} from '@/lib/api-error';

const { boardPolls, boardPollOptions, boardPollVotes, members } = sharedDb;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const database = getDb();

    // Fetch polls with options
    const polls = await database
      .select({
        id: boardPolls.id,
        question: boardPolls.question,
        pollType: boardPolls.pollType,
        expiresAt: boardPolls.expiresAt,
        allowAddOption: boardPolls.allowAddOption,
        options: {
          id: boardPollOptions.id,
          optionText: boardPollOptions.optionText,
          optionOrder: boardPollOptions.optionOrder,
        },
      })
      .from(boardPolls)
      .innerJoin(boardPollOptions, eq(boardPolls.id, boardPollOptions.pollId))
      .where(
        and(
          eq(boardPolls.postId, postId),
          isNull(boardPolls.deletedAt)
        )
      )
      .orderBy(desc(boardPolls.createdAt), boardPollOptions.optionOrder);

    if (!polls.length) {
      return successResponse({ polls: [] });
    }

    // Group by poll
    type PollRow = typeof polls[0];
    type GroupedPoll = Omit<PollRow, 'options'> & {
      options: Array<PollRow['options']>;
    };

    const groupedPolls: Record<string, GroupedPoll> = {};

    for (const row of polls) {
      if (!groupedPolls[row.id]) {
        const { options, ...pollWithoutOptions } = row;
        groupedPolls[row.id] = {
          ...pollWithoutOptions,
          options: [],
        } as GroupedPoll;
      }
      groupedPolls[row.id]!.options.push(row.options);
    }

    // For each poll, fetch vote counts and user votes
    const pollData = await Promise.all(
      Object.values(groupedPolls).map(async (poll) => {
        // Get all votes for this poll with voter info (unless anonymous)
        const votes = await database
          .select({
            optionId: boardPollVotes.optionId,
            memberId: boardPollVotes.memberId,
            memberName: members.name,
            memberProfileImage: members.profileImageUrl,
            memberDiscordId: members.discordId,
            votedAt: boardPollVotes.createdAt,
          })
          .from(boardPollVotes)
          .leftJoin(members, eq(boardPollVotes.memberId, members.id))
          .where(eq(boardPollVotes.pollId, poll.id));

        // Count total votes
        const totalVotes = votes.length;

        // Group votes by option
        const votesByOption: Record<string, typeof votes> = {};

        for (const vote of votes) {
          if (!votesByOption[vote.optionId]) {
            votesByOption[vote.optionId] = [];
          }
          // Only include voter info if not anonymous poll
          if (poll.pollType !== 'anonymous' && vote.memberId) {
            votesByOption[vote.optionId]!.push(vote);
          }
        }

        // Check if current user has voted
        const userVotes = poll.pollType !== 'anonymous'
          ? votes.filter((v) => v.memberId === auth.memberId)
          : [];

        const hasVoted = userVotes.length > 0;
        const userVotedOptionIds = userVotes.map((v) => v.optionId);

        // Build options with vote data
        const optionsWithVotes = poll.options.map((opt) => {
          const optionVotes = votesByOption[opt.id] || [];
          const voteCount = optionVotes.length;
          const percentage =
            totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
          const voted = userVotedOptionIds.includes(opt.id);

          return {
            ...opt,
            voteCount,
            percentage: Math.round(percentage * 10) / 10,
            voted,
            voters:
              poll.pollType !== 'anonymous'
                ? optionVotes.map((v) => ({
                    memberId: v.memberId!,
                    name: v.memberName || '익명',
                    profileImage: v.memberProfileImage,
                    discordId: v.memberDiscordId || '',
                    votedAt: v.votedAt,
                  }))
                : [],
          };
        });

        // Check if expired
        const isExpired = new Date(poll.expiresAt) < new Date();

        return {
          id: poll.id,
          question: poll.question,
          pollType: poll.pollType,
          expiresAt: poll.expiresAt,
          allowAddOption: poll.allowAddOption,
          isExpired,
          hasVoted,
          totalVotes,
          options: optionsWithVotes,
        };
      })
    );

    const response = successResponse({ polls: pollData });
    // 5초 캐시로 투표 후 빠른 반영 + 성능 확보
    return withCache(response, 5, 'private');
  } catch (error) {
    return errorResponse(error);
  }
}
