import { NextRequest, NextResponse } from 'next/server';
import { eq, count, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';

const { members, posts, attendance, AttendanceStatus } = sharedDb;

/**
 * GET /api/members
 * Get all members with basic stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    const database = db();

    // Get members by status
    const membersList = await database
      .select()
      .from(members)
      .where(eq(members.status, status));

    // Get post counts for all members
    const postCounts = await database
      .select({
        memberId: posts.memberId,
        count: count(),
      })
      .from(posts)
      .groupBy(posts.memberId);

    // Get attendance stats for all members
    const attendanceStats = await database
      .select({
        memberId: attendance.memberId,
        total: count(),
        submitted: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.SUBMITTED} THEN 1 END)`,
      })
      .from(attendance)
      .groupBy(attendance.memberId);

    // Create maps for quick lookup
    const postCountMap = new Map(postCounts.map((p) => [p.memberId, p.count]));
    const attendanceMap = new Map(
      attendanceStats.map((a) => [a.memberId, { total: a.total, submitted: a.submitted }])
    );

    const result = membersList.map((member) => {
      const postCount = postCountMap.get(member.id) || 0;
      const attStats = attendanceMap.get(member.id) || { total: 0, submitted: 0 };
      const attendanceRate = attStats.total > 0
        ? Math.round((attStats.submitted / attStats.total) * 100)
        : 0;

      return {
        id: member.id,
        discordUsername: member.discordUsername,
        name: member.name,
        part: member.part,
        blogUrl: member.blogUrl,
        profileImageUrl: member.profileImageUrl,
        bio: member.bio,
        status: member.status,
        postCount,
        attendanceRate,
        joinedAt: member.joinedAt,
      };
    });

    return NextResponse.json({
      members: result,
      total: result.length,
    });
  } catch (error) {
    console.error('Members API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
