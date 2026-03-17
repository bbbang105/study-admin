import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { Errors, successResponse } from '@/lib/api-error';

const { members, posts, rounds, attendance, MemberStatus, AttendanceStatus } = sharedDb;

/**
 * GET /api/dashboard
 * Get dashboard data including current round info and recent posts
 * Requirement: 18.1
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Errors.unauthorized().toResponse();
    }

    const database = db();

    // Get current user's member info
    const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
    const discordId = discordIdentity?.id;
    let currentUserNickname: string | null = null;
    let currentMemberId: string | null = null;
    if (discordId) {
      const [me] = await database
        .select({ id: members.id, nickname: members.nickname, discordUsername: members.discordUsername })
        .from(members)
        .where(eq(members.discordId, discordId))
        .limit(1);
      currentUserNickname = me?.nickname || me?.discordUsername || null;
      currentMemberId = me?.id ?? null;
    }

    // Fan out all top-level independent queries in parallel
    const [roundRows, recentPostsResult, activeMembersResult, totalPostsResult] =
      await Promise.all([
        database
          .select()
          .from(rounds)
          .where(eq(rounds.isCurrent, true))
          .limit(1),

        database
          .select({
            id: posts.id,
            title: posts.title,
            url: posts.url,
            publishedAt: posts.publishedAt,
            memberId: members.id,
            memberName: members.name,
            memberNickname: members.nickname,
            memberDiscordUsername: members.discordUsername,
            memberProfileImageUrl: members.profileImageUrl,
          })
          .from(posts)
          .leftJoin(members, eq(posts.memberId, members.id))
          .orderBy(desc(posts.publishedAt))
          .limit(5),

        database
          .select({ count: count() })
          .from(members)
          .where(eq(members.status, MemberStatus.ACTIVE)),

        database.select({ count: count() }).from(posts),
      ]);

    const currentRoundData = roundRows[0];
    const totalActiveMembers = activeMembersResult[0]?.count ?? 0;

    let currentRound = null;
    if (currentRoundData) {
      const now = new Date();
      const endDate = new Date(currentRoundData.endDate);
      const endOfDeadline = new Date(endDate);
      endOfDeadline.setHours(23, 59, 59, 999);
      const graceEndDate = new Date(currentRoundData.graceEndDate);
      const endOfGrace = new Date(graceEndDate);
      endOfGrace.setHours(23, 59, 59, 999);

      const timeDiff = endOfDeadline.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      const isGracePeriod = now > endOfDeadline && now <= endOfGrace;

      // Parallelize attendance stats + my attendance query
      const [attendanceStats, myAttendanceRow] = await Promise.all([
        database
          .select({ status: attendance.status, count: count() })
          .from(attendance)
          .where(eq(attendance.roundId, currentRoundData.id))
          .groupBy(attendance.status),

        currentMemberId
          ? database
              .select({ status: attendance.status })
              .from(attendance)
              .where(
                and(
                  eq(attendance.roundId, currentRoundData.id),
                  eq(attendance.memberId, currentMemberId),
                ),
              )
              .limit(1)
          : Promise.resolve([] as { status: string }[]),
      ]);

      const statsMap = new Map(attendanceStats.map((s) => [s.status, s.count]));
      const submitted =
        (statsMap.get(AttendanceStatus.SUBMITTED) || 0) +
        (statsMap.get(AttendanceStatus.LATE) || 0);

      currentRound = {
        roundNumber: currentRoundData.roundNumber,
        startDate: currentRoundData.startDate,
        endDate: currentRoundData.endDate,
        graceEndDate: currentRoundData.graceEndDate,
        daysRemaining: Math.max(0, daysRemaining),
        isGracePeriod,
        submissionRate:
          totalActiveMembers > 0 ? Math.round((submitted / totalActiveMembers) * 100) : 0,
        myAttendanceStatus: myAttendanceRow[0]?.status ?? null,
      };
    }

    return successResponse({
      nickname: currentUserNickname,
      currentRound,
      recentPosts: recentPostsResult.map((post) => ({
        id: post.id,
        title: post.title,
        url: post.url,
        publishedAt: post.publishedAt?.toISOString(),
        memberId: post.memberId,
        memberName: post.memberName,
        memberNickname: post.memberNickname,
        memberDiscordUsername: post.memberDiscordUsername,
        memberProfileImageUrl: post.memberProfileImageUrl,
      })),
      totalMembers: totalActiveMembers,
      totalPosts: totalPostsResult[0]?.count ?? 0,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return Errors.internalError().toResponse();
  }
}
