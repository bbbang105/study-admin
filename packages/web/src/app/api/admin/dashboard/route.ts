import { NextResponse } from 'next/server';
import { eq, desc, count, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';

const { members, posts, rounds, attendance, fines, MemberStatus, AttendanceStatus, FineStatus } = sharedDb;

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
      const endDate = new Date(currentRoundData.endDate);
      const graceEndDate = new Date(currentRoundData.graceEndDate);
      
      // Calculate days remaining
      const timeDiff = endDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      // Check if in grace period
      const isGracePeriod = now > endDate && now <= graceEndDate;

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
      const total = attendanceStats.reduce((sum, s) => sum + s.count, 0);
      const submitted = statsMap.get(AttendanceStatus.SUBMITTED) || 0;
      const late = statsMap.get(AttendanceStatus.LATE) || 0;
      const absent = statsMap.get(AttendanceStatus.ABSENT) || 0;
      const pending = statsMap.get(AttendanceStatus.PENDING) || 0;

      submissionStats = {
        total,
        submitted,
        late,
        absent,
        pending,
        submissionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
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

    // Get total posts count
    const [totalPostsResult] = await database
      .select({ count: count() })
      .from(posts);

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
        memberName: members.name,
        memberDiscordUsername: members.discordUsername,
      })
      .from(posts)
      .leftJoin(members, eq(posts.memberId, members.id))
      .orderBy(desc(posts.collectedAt))
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
          memberName: post.memberName,
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
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
