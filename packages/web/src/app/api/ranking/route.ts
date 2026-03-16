import { NextRequest } from 'next/server';
import { count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { errorResponse, Errors, successResponse, withCache } from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';

const { members, posts, attendance, rounds, activityScores, MemberStatus, AttendanceStatus } =
  sharedDb;

const VALID_SORT_KEYS = ['score', 'posts', 'activity'] as const;
type SortKey = (typeof VALID_SORT_KEYS)[number];

/**
 * Calculate consecutive submitted rounds (streak) for each member
 * Counts backwards from the most recent round
 */
async function calculateStreaks(database: ReturnType<typeof db>) {
  // Get all attendance records ordered by round number descending
  const allAttendance = await database
    .select({
      memberId: attendance.memberId,
      roundNumber: rounds.roundNumber,
      status: attendance.status,
    })
    .from(attendance)
    .innerJoin(rounds, eq(attendance.roundId, rounds.id))
    .orderBy(desc(rounds.roundNumber));

  // Group by member and calculate streak
  const streakMap = new Map<string, number>();
  const memberRounds = new Map<string, { roundNumber: number; status: string }[]>();

  for (const record of allAttendance) {
    const existing = memberRounds.get(record.memberId) || [];
    existing.push({ roundNumber: record.roundNumber, status: record.status });
    memberRounds.set(record.memberId, existing);
  }

  for (const [memberId, records] of memberRounds) {
    // Already sorted desc by roundNumber
    let streak = 0;
    for (const record of records) {
      if (record.status === AttendanceStatus.SUBMITTED) {
        streak++;
      } else {
        break;
      }
    }
    streakMap.set(memberId, streak);
  }

  return streakMap;
}

/**
 * Calculate rank deltas by comparing current ranking to previous round ranking.
 * For each sortBy, we compute each member's "previous value" (before the current round)
 * and sort by that to determine the previous rank.
 */
function calculateRankDeltas(
  currentRankings: Array<{
    id: string;
    postCount: number;
    currentRoundPosts: number;
    totalScore: number;
    currentRoundScore: number;
    discordScoreTotal: number;
    currentRoundDiscordScore: number;
  }>,
  sortBy: SortKey
) {
  const getPreviousValue = (m: (typeof currentRankings)[0]): number => {
    switch (sortBy) {
      case 'posts':
        return m.postCount - m.currentRoundPosts;
      case 'score':
        return m.totalScore - m.currentRoundScore;
      case 'activity':
        return m.discordScoreTotal - m.currentRoundDiscordScore;
    }
  };

  // Build previous rankings sorted by previous value
  const previousRankings = [...currentRankings].sort(
    (a, b) => getPreviousValue(b) - getPreviousValue(a)
  );

  const previousRankMap = new Map<string, number>();
  previousRankings.forEach((member, index) => {
    previousRankMap.set(member.id, index + 1);
  });

  const deltaMap = new Map<string, number>();
  currentRankings.forEach((member, index) => {
    const currentRank = index + 1;
    const previousRank = previousRankMap.get(member.id) ?? currentRank;
    // Positive delta = moved up (previous rank was higher number = lower position)
    deltaMap.set(member.id, previousRank - currentRank);
  });

  return deltaMap;
}

/**
 * GET /api/ranking
 * Get member rankings with gamification data (streak, delta, heatmap)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Errors.unauthorized().toResponse();
    }

    const { searchParams } = new URL(request.url);
    const rawSort = searchParams.get('sortBy') ?? 'score';
    const sortBy: SortKey = (VALID_SORT_KEYS as readonly string[]).includes(rawSort)
      ? (rawSort as SortKey)
      : 'score';

    const database = db();

    // Get current round
    const currentRound = await database
      .select()
      .from(rounds)
      .where(eq(rounds.isCurrent, true))
      .limit(1);

    const currentRoundId = currentRound[0]?.id ?? null;

    // Get all active members with their total post counts
    const membersWithPosts = await database
      .select({
        id: members.id,
        name: members.name,
        nickname: members.nickname,
        discordUsername: members.discordUsername,
        profileImageUrl: members.profileImageUrl,
        postCount: count(posts.id),
      })
      .from(members)
      .leftJoin(posts, eq(members.id, posts.memberId))
      .where(eq(members.status, MemberStatus.ACTIVE))
      .groupBy(members.id);

    // Get current round post counts
    const currentRoundPostCounts = new Map<string, number>();
    if (currentRoundId) {
      const crPosts = await database
        .select({
          memberId: posts.memberId,
          count: count(posts.id),
        })
        .from(posts)
        .where(eq(posts.roundId, currentRoundId))
        .groupBy(posts.memberId);

      for (const row of crPosts) {
        currentRoundPostCounts.set(row.memberId, row.count);
      }
    }

    // Get attendance stats for each member
    const attendanceStats = await database
      .select({
        memberId: attendance.memberId,
        totalRounds: count(attendance.id),
        submittedRounds:
          sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.SUBMITTED} THEN 1 END)`.as(
            'submitted_rounds'
          ),
      })
      .from(attendance)
      .groupBy(attendance.memberId);

    const attendanceMap = new Map(
      attendanceStats.map((stat) => [
        stat.memberId,
        {
          totalRounds: stat.totalRounds,
          submittedRounds: stat.submittedRounds,
        },
      ])
    );

    // Get recent attendance history (last 10 rounds) for heatmap
    const recentRounds = await database
      .select({ id: rounds.id, roundNumber: rounds.roundNumber })
      .from(rounds)
      .orderBy(desc(rounds.roundNumber))
      .limit(10);

    const recentRoundIds = recentRounds.map((r) => r.id);
    const roundNumberMap = new Map(recentRounds.map((r) => [r.id, r.roundNumber]));

    const attendanceHistoryMap = new Map<string, { roundNumber: number; status: string }[]>();
    if (recentRoundIds.length > 0) {
      const recentAttendance = await database
        .select({
          memberId: attendance.memberId,
          roundId: attendance.roundId,
          status: attendance.status,
        })
        .from(attendance)
        .where(inArray(attendance.roundId, recentRoundIds));

      for (const record of recentAttendance) {
        const existing = attendanceHistoryMap.get(record.memberId) || [];
        existing.push({
          roundNumber: roundNumberMap.get(record.roundId) ?? 0,
          status: record.status,
        });
        attendanceHistoryMap.set(record.memberId, existing);
      }

      // Sort each member's history by roundNumber ascending
      for (const [memberId, history] of attendanceHistoryMap) {
        history.sort((a, b) => a.roundNumber - b.roundNumber);
        attendanceHistoryMap.set(memberId, history);
      }
    }

    // Calculate streaks
    const streakMap = await calculateStreaks(database);

    // Get activity scores per member: total + web activity breakdown (graceful if table doesn't exist yet)
    let scoreMap = new Map<string, number>();
    // Keys: total=웹활동합계, message=게시판글, thread=포스트댓글, reaction=게시판댓글 (레거시 키명, 클라이언트 호환)
    let discordScoreMap = new Map<
      string,
      { total: number; message: number; thread: number; reaction: number }
    >();
    // Current round scores for rank delta calculation
    let currentRoundScoreMap = new Map<string, number>();
    let currentRoundDiscordScoreMap = new Map<string, number>();
    try {
      const scoreStats = await database
        .select({
          memberId: activityScores.memberId,
          totalScore: sql<number>`COALESCE(SUM(${activityScores.points}), 0)`,
          webActivityScore: sql<number>`COALESCE(SUM(CASE WHEN ${activityScores.type} IN ('board_post','post_comment','board_comment','post_view') THEN ${activityScores.points} ELSE 0 END), 0)`,
          boardPostScore: sql<number>`COALESCE(SUM(CASE WHEN ${activityScores.type} = 'board_post' THEN ${activityScores.points} ELSE 0 END), 0)`,
          postCommentScore: sql<number>`COALESCE(SUM(CASE WHEN ${activityScores.type} = 'post_comment' THEN ${activityScores.points} ELSE 0 END), 0)`,
          boardCommentScore: sql<number>`COALESCE(SUM(CASE WHEN ${activityScores.type} = 'board_comment' THEN ${activityScores.points} ELSE 0 END), 0)`,
          postViewScore: sql<number>`COALESCE(SUM(CASE WHEN ${activityScores.type} = 'post_view' THEN ${activityScores.points} ELSE 0 END), 0)`,
        })
        .from(activityScores)
        .groupBy(activityScores.memberId);

      scoreMap = new Map(scoreStats.map((s) => [s.memberId, Number(s.totalScore)]));
      discordScoreMap = new Map(
        scoreStats.map((s) => [
          s.memberId,
          {
            total: Number(s.webActivityScore),
            message: Number(s.boardPostScore),
            thread: Number(s.postCommentScore),
            reaction: Number(s.boardCommentScore),
          },
        ])
      );

      // Query current round's activity scores for rank delta (using round date range)
      if (currentRound[0]) {
        const crScores = await database
          .select({
            memberId: activityScores.memberId,
            roundScore: sql<number>`COALESCE(SUM(${activityScores.points}), 0)`,
            roundDiscordScore: sql<number>`COALESCE(SUM(CASE WHEN ${activityScores.type} IN ('board_post','post_comment','board_comment','post_view') THEN ${activityScores.points} ELSE 0 END), 0)`,
          })
          .from(activityScores)
          .where(
            sql`${activityScores.date} >= ${currentRound[0].startDate} AND ${activityScores.date} <= ${currentRound[0].endDate}`
          )
          .groupBy(activityScores.memberId);

        currentRoundScoreMap = new Map(crScores.map((s) => [s.memberId, Number(s.roundScore)]));
        currentRoundDiscordScoreMap = new Map(
          crScores.map((s) => [s.memberId, Number(s.roundDiscordScore)])
        );
      }
    } catch (scoreError) {
      const msg = scoreError instanceof Error ? scoreError.message : '';
      if (!msg.includes('does not exist')) {
        console.error('Activity scores query error:', scoreError);
      }
    }

    // Combine all data
    const rankings = membersWithPosts.map((member) => {
      const stats = attendanceMap.get(member.id) || { totalRounds: 0, submittedRounds: 0 };
      const attendanceRate =
        stats.totalRounds > 0 ? (stats.submittedRounds / stats.totalRounds) * 100 : 0;

      return {
        id: member.id,
        name: member.name,
        nickname: member.nickname,
        discordUsername: member.discordUsername,
        profileImageUrl: member.profileImageUrl,
        postCount: member.postCount,
        attendanceRate,
        submittedRounds: stats.submittedRounds,
        totalRounds: stats.totalRounds,
        currentStreak: streakMap.get(member.id) ?? 0,
        currentRoundPosts: currentRoundPostCounts.get(member.id) ?? 0,
        attendanceHistory: attendanceHistoryMap.get(member.id) ?? [],
        totalScore: scoreMap.get(member.id) ?? 0,
        discordScore: discordScoreMap.get(member.id) ?? {
          total: 0,
          message: 0,
          thread: 0,
          reaction: 0,
        },
      };
    });

    // Sort based on sortBy parameter
    if (sortBy === 'activity') {
      rankings.sort(
        (a, b) => b.discordScore.total - a.discordScore.total || b.totalScore - a.totalScore
      );
    } else if (sortBy === 'posts') {
      rankings.sort((a, b) => b.postCount - a.postCount || b.totalScore - a.totalScore);
    } else {
      // score (default)
      rankings.sort((a, b) => b.totalScore - a.totalScore || b.postCount - a.postCount);
    }

    // Calculate rank deltas per sort type
    const deltaInput = rankings.map((m) => ({
      id: m.id,
      postCount: m.postCount,
      currentRoundPosts: m.currentRoundPosts,
      totalScore: m.totalScore,
      currentRoundScore: currentRoundScoreMap.get(m.id) ?? 0,
      discordScoreTotal: m.discordScore.total,
      currentRoundDiscordScore: currentRoundDiscordScoreMap.get(m.id) ?? 0,
    }));
    const deltaMap = calculateRankDeltas(deltaInput, sortBy);

    // Add rank delta to each member
    const rankingsWithDelta = rankings.map((member) => ({
      ...member,
      rankDelta: deltaMap.get(member.id) ?? 0,
    }));

    // Get current user's Discord ID for highlighting
    const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
    const currentUserDiscordId = discordIdentity?.id ?? null;

    // Find current user's member ID
    let currentUserId: string | null = null;
    if (currentUserDiscordId) {
      const currentMember = await database
        .select({ id: members.id })
        .from(members)
        .where(eq(members.discordId, currentUserDiscordId))
        .limit(1);
      currentUserId = currentMember[0]?.id ?? null;
    }

    return withCache(
      successResponse({
        rankings: rankingsWithDelta,
        totalMembers: rankingsWithDelta.length,
        currentUserId,
        currentRound: currentRound[0]
          ? { id: currentRound[0].id, roundNumber: currentRound[0].roundNumber }
          : null,
      }),
      30
    );
  } catch (error) {
    console.error('Ranking API error:', error);
    return errorResponse(error);
  }
}
