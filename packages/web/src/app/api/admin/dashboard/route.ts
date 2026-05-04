import { NextResponse } from 'next/server';
import { count, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';

const { members, posts, rounds, attendance, fines, MemberStatus, AttendanceStatus, FineStatus } =
  sharedDb;

/**
 * GET /api/admin/dashboard
 * Get admin dashboard data including current round summary, submission rate, and recent activity
 * Requirement: 16.4
 */
export const GET = withAdminAuth(async (_request, _adminAuth) => {
  try {
    const database = db();

    // Get current round
    const [currentRoundData] = await database
      .select()
      .from(rounds)
      .where(eq(rounds.isCurrent, true))
      .limit(1);

    let currentRound = null;
    let submissionStats = null;

    if (currentRoundData) {
      const now = new Date();
      const endOfDeadline = new Date(`${currentRoundData.endDate}T23:59:59.999+09:00`);
      const endOfGrace = new Date(`${currentRoundData.graceEndDate}T23:59:59.999+09:00`);

      // KST 캘린더 날짜 기준 D-Day 계산 (당일 = D-Day = 0)
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = kstNow.toISOString().split('T')[0]!;
      const todayMidnight = new Date(`${todayStr}T00:00:00+09:00`);
      const endMidnight = new Date(`${currentRoundData.endDate}T00:00:00+09:00`);
      const daysRemaining = Math.round(
        (endMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 지각: 마감일 다음 날부터 ~ 지각 마감일 23:59:59까지
      const isGracePeriod = now > endOfDeadline && now <= endOfGrace;

      currentRound = {
        id: currentRoundData.id,
        roundNumber: currentRoundData.roundNumber,
        startDate: currentRoundData.startDate,
        endDate: currentRoundData.endDate,
        graceEndDate: currentRoundData.graceEndDate,
        daysRemaining: Math.max(0, daysRemaining),
        isGracePeriod,
      };

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
      const late = statsMap.get(AttendanceStatus.LATE) || 0;
      const absent = statsMap.get(AttendanceStatus.ABSENT) || 0;
      const pending = statsMap.get(AttendanceStatus.PENDING) || 0;

      // 활성 멤버 수 기준으로 제출률 계산
      const [activeMembersResult] = await database
        .select({ count: count() })
        .from(members)
        .where(eq(members.status, MemberStatus.ACTIVE));
      const totalActiveMembers = activeMembersResult?.count ?? 0;

      submissionStats = {
        total: totalActiveMembers,
        submitted,
        late,
        absent,
        pending,
        submissionRate:
          totalActiveMembers > 0 ? Math.round((submitted / totalActiveMembers) * 100) : 0,
      };
    }

    // Get member counts by status
    const memberCounts = await database
      .select({
        status: members.status,
        count: count(),
      })
      .from(members)
      .groupBy(members.status);

    const memberCountMap = new Map(memberCounts.map((m) => [m.status, m.count]));

    // Get total posts count (soft deleted 제외)
    const [totalPostsResult] = await database
      .select({ count: count() })
      .from(posts)
      .where(isNull(posts.deletedAt));

    // Get unpaid fines summary
    const [unpaidFinesResult] = await database
      .select({
        count: count(),
        total: sql<number>`COALESCE(SUM(${fines.amount}), 0)`,
      })
      .from(fines)
      .where(eq(fines.status, FineStatus.UNPAID));

    // Get recent activity (recent posts)
    const recentPosts = await database
      .select({
        id: posts.id,
        title: posts.title,
        url: posts.url,
        publishedAt: posts.publishedAt,
        memberNickname: members.nickname,
        memberDiscordUsername: members.discordUsername,
      })
      .from(posts)
      .leftJoin(members, eq(posts.memberId, members.id))
      .where(isNull(posts.deletedAt))
      .orderBy(desc(posts.publishedAt))
      .limit(5);

    // Get recent attendance changes
    const recentAttendance = await database
      .select({
        id: attendance.id,
        status: attendance.status,
        updatedAt: attendance.updatedAt,
        memberName: members.name,
        memberDiscordUsername: members.discordUsername,
        roundNumber: rounds.roundNumber,
      })
      .from(attendance)
      .leftJoin(members, eq(attendance.memberId, members.id))
      .leftJoin(rounds, eq(attendance.roundId, rounds.id))
      .orderBy(desc(attendance.updatedAt))
      .limit(5);

    return NextResponse.json({
      currentRound,
      submissionStats,
      memberCounts: {
        active: memberCountMap.get(MemberStatus.ACTIVE) || 0,
        dormant: memberCountMap.get(MemberStatus.DORMANT) || 0,
        withdrawn: memberCountMap.get(MemberStatus.WITHDRAWN) || 0,
        total: memberCounts.reduce((sum, m) => sum + m.count, 0),
      },
      totalPosts: totalPostsResult?.count ?? 0,
      unpaidFines: {
        count: unpaidFinesResult?.count ?? 0,
        total: unpaidFinesResult?.total ?? 0,
      },
      recentActivity: {
        posts: recentPosts.map((post) => ({
          id: post.id,
          title: post.title,
          url: post.url,
          publishedAt: post.publishedAt?.toISOString(),
          memberNickname: post.memberNickname,
          memberDiscordUsername: post.memberDiscordUsername,
        })),
        attendance: recentAttendance.map((att) => ({
          id: att.id,
          status: att.status,
          updatedAt: att.updatedAt?.toISOString(),
          memberName: att.memberName,
          memberDiscordUsername: att.memberDiscordUsername,
          roundNumber: att.roundNumber,
        })),
      },
    });
  } catch (error) {
    console.error('Admin dashboard API error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
});
