import { NextRequest } from 'next/server';
import { eq, count, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { successResponse, errorResponse } from '@/lib/api-error';

const { members, posts, attendance, MemberStatus, AttendanceStatus } = sharedDb;

/**
 * GET /api/ranking
 * Get member rankings by post count and attendance rate
 * Requirement: 18.4
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'posts';

    const database = db();

    // Get all active members with their post counts
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

    // Get attendance stats for each member
    const attendanceStats = await database
      .select({
        memberId: attendance.memberId,
        totalRounds: count(attendance.id),
        submittedRounds: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.SUBMITTED} THEN 1 END)`.as('submitted_rounds'),
      })
      .from(attendance)
      .groupBy(attendance.memberId);

    // Create a map of attendance stats
    const attendanceMap = new Map(
      attendanceStats.map((stat) => [
        stat.memberId,
        {
          totalRounds: stat.totalRounds,
          submittedRounds: stat.submittedRounds,
        },
      ])
    );

    // Combine data and calculate attendance rate
    const rankings = membersWithPosts.map((member) => {
      const stats = attendanceMap.get(member.id) || { totalRounds: 0, submittedRounds: 0 };
      const attendanceRate = stats.totalRounds > 0
        ? (stats.submittedRounds / stats.totalRounds) * 100
        : 0;

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
      };
    });

    // Sort based on sortBy parameter
    if (sortBy === 'attendance') {
      rankings.sort((a, b) => b.attendanceRate - a.attendanceRate || b.postCount - a.postCount);
    } else {
      rankings.sort((a, b) => b.postCount - a.postCount || b.attendanceRate - a.attendanceRate);
    }

    return successResponse({
      rankings,
      totalMembers: rankings.length,
    });
  } catch (error) {
    console.error('Ranking API error:', error);
    return errorResponse(error);
  }
}
