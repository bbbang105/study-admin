import { count, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { errorResponse, successResponse } from '@/lib/api-error';

const { rounds, attendance, posts, members, MemberStatus, AttendanceStatus } = sharedDb;

/**
 * GET /api/stats
 * Get overall study statistics
 * Requirement: 9.4 - /통계 command equivalent
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roundNumber = searchParams.get('round');

    const database = db();

    // If specific round requested
    if (roundNumber) {
      const roundNum = parseInt(roundNumber, 10);
      if (isNaN(roundNum)) {
        return successResponse({ error: '유효하지 않은 회차 번호입니다.' });
      }

      const [roundData] = await database
        .select()
        .from(rounds)
        .where(eq(rounds.roundNumber, roundNum))
        .limit(1);

      if (!roundData) {
        return successResponse({ error: '회차를 찾을 수 없습니다.' });
      }

      // Get attendance stats for this round
      const attendanceStats = await database
        .select({
          status: attendance.status,
          count: count(),
        })
        .from(attendance)
        .where(eq(attendance.roundId, roundData.id))
        .groupBy(attendance.status);

      const statsMap = new Map(attendanceStats.map((s) => [s.status, s.count]));
      const total = attendanceStats.reduce((sum, s) => sum + s.count, 0);
      const submitted = statsMap.get(AttendanceStatus.SUBMITTED) || 0;
      const late = statsMap.get(AttendanceStatus.LATE) || 0;
      const absent = statsMap.get(AttendanceStatus.ABSENT) || 0;

      // Get top contributors for this round
      const topContributors = await database
        .select({
          memberId: posts.memberId,
          memberName: members.name,
          memberDiscordUsername: members.discordUsername,
          postCount: count(),
        })
        .from(posts)
        .leftJoin(members, eq(posts.memberId, members.id))
        .where(eq(posts.roundId, roundData.id))
        .groupBy(posts.memberId, members.name, members.discordUsername)
        .orderBy(desc(count()))
        .limit(5);

      return successResponse({
        round: {
          roundNumber: roundData.roundNumber,
          startDate: roundData.startDate,
          endDate: roundData.endDate,
        },
        stats: {
          total,
          submitted,
          late,
          absent,
          submissionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
          lateRate: total > 0 ? Math.round((late / total) * 100) : 0,
          absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
        },
        topContributors: topContributors.map((c, index) => ({
          rank: index + 1,
          name: c.memberName,
          discordUsername: c.memberDiscordUsername,
          postCount: c.postCount,
        })),
      });
    }

    // Overall statistics
    const [totalMembersResult] = await database
      .select({ count: count() })
      .from(members)
      .where(eq(members.status, MemberStatus.ACTIVE));

    const [totalPostsResult] = await database.select({ count: count() }).from(posts);

    const [totalRoundsResult] = await database.select({ count: count() }).from(rounds);

    // Get overall attendance stats
    const overallAttendance = await database
      .select({
        status: attendance.status,
        count: count(),
      })
      .from(attendance)
      .groupBy(attendance.status);

    const overallStatsMap = new Map(overallAttendance.map((s) => [s.status, s.count]));
    const overallTotal = overallAttendance.reduce((sum, s) => sum + s.count, 0);
    const overallSubmitted = overallStatsMap.get(AttendanceStatus.SUBMITTED) || 0;
    const overallLate = overallStatsMap.get(AttendanceStatus.LATE) || 0;
    const overallAbsent = overallStatsMap.get(AttendanceStatus.ABSENT) || 0;

    // Get per-round statistics
    const roundStats = await database
      .select({
        roundId: attendance.roundId,
        roundNumber: rounds.roundNumber,
        total: count(),
        submitted: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.SUBMITTED} THEN 1 END)`,
        late: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.LATE} THEN 1 END)`,
        absent: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.ABSENT} THEN 1 END)`,
      })
      .from(attendance)
      .leftJoin(rounds, eq(attendance.roundId, rounds.id))
      .groupBy(attendance.roundId, rounds.roundNumber)
      .orderBy(rounds.roundNumber);

    return successResponse({
      overview: {
        totalMembers: totalMembersResult?.count ?? 0,
        totalPosts: totalPostsResult?.count ?? 0,
        totalRounds: totalRoundsResult?.count ?? 0,
        overallSubmissionRate:
          overallTotal > 0 ? Math.round((overallSubmitted / overallTotal) * 100) : 0,
        overallLateRate: overallTotal > 0 ? Math.round((overallLate / overallTotal) * 100) : 0,
        overallAbsentRate: overallTotal > 0 ? Math.round((overallAbsent / overallTotal) * 100) : 0,
      },
      roundStats: roundStats.map((r) => ({
        roundNumber: r.roundNumber,
        total: r.total,
        submitted: r.submitted,
        late: r.late,
        absent: r.absent,
        submissionRate: r.total > 0 ? Math.round((r.submitted / r.total) * 100) : 0,
      })),
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return errorResponse(error);
  }
}
