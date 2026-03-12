import { count, desc, eq } from 'drizzle-orm';
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
    if (discordId) {
      const [me] = await database
        .select({ nickname: members.nickname, discordUsername: members.discordUsername })
        .from(members)
        .where(eq(members.discordId, discordId))
        .limit(1);
      currentUserNickname = me?.nickname || me?.discordUsername || null;
    }

    // Get current round
    const [currentRoundData] = await database
      .select()
      .from(rounds)
      .where(eq(rounds.isCurrent, true))
      .limit(1);

    let currentRound = null;
    if (currentRoundData) {
      const now = new Date();
      // endDate 당일은 마감일이므로 23:59:59까지 정상 기간
      // 지각은 endDate 다음 날부터 (마감일+1), 결석은 graceEndDate 다음 날부터
      const endDate = new Date(currentRoundData.endDate);
      const endOfDeadline = new Date(endDate);
      endOfDeadline.setHours(23, 59, 59, 999);
      const graceEndDate = new Date(currentRoundData.graceEndDate);
      const endOfGrace = new Date(graceEndDate);
      endOfGrace.setHours(23, 59, 59, 999);

      // Calculate days remaining (based on end of deadline day)
      const timeDiff = endOfDeadline.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      // Check if in grace period (after deadline day, within grace day)
      const isGracePeriod = now > endOfDeadline && now <= endOfGrace;

      // Get submission stats for current round
      const attendanceStats = await database
        .select({
          status: attendance.status,
          count: count(),
        })
        .from(attendance)
        .where(eq(attendance.roundId, currentRoundData.id))
        .groupBy(attendance.status);

      const statsMap = new Map(attendanceStats.map((s) => [s.status, s.count]));
      const submitted = statsMap.get(AttendanceStatus.SUBMITTED) || 0;

      // 활성 멤버 수를 기준으로 제출률 계산
      const [activeMembersResult] = await database
        .select({ count: count() })
        .from(members)
        .where(eq(members.status, MemberStatus.ACTIVE));
      const totalActiveMembers = activeMembersResult?.count ?? 0;

      currentRound = {
        roundNumber: currentRoundData.roundNumber,
        startDate: currentRoundData.startDate,
        endDate: currentRoundData.endDate,
        graceEndDate: currentRoundData.graceEndDate,
        daysRemaining: Math.max(0, daysRemaining),
        isGracePeriod,
        submissionRate:
          totalActiveMembers > 0 ? Math.round((submitted / totalActiveMembers) * 100) : 0,
      };
    }

    // Get recent posts with member info
    const recentPostsResult = await database
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
      .limit(5);

    // Get total active members count
    const totalMembersResult = await database
      .select({ count: count() })
      .from(members)
      .where(eq(members.status, MemberStatus.ACTIVE));

    // Get total posts count
    const totalPostsResult = await database.select({ count: count() }).from(posts);

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
      totalMembers: totalMembersResult[0]?.count ?? 0,
      totalPosts: totalPostsResult[0]?.count ?? 0,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return Errors.internalError().toResponse();
  }
}
