import { NextRequest, NextResponse } from 'next/server';
import { eq, count, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';

const { members, posts, attendance, AttendanceStatus } = sharedDb;

/**
 * GET /api/members/[id]
 * Get member profile by ID
 * Requirement: 20.6
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { message: '멤버 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const database = db();

    // Get member by ID
    const [member] = await database
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    if (!member) {
      return NextResponse.json(
        { message: '멤버를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Get post count
    const [postCount] = await database
      .select({ count: count() })
      .from(posts)
      .where(eq(posts.memberId, member.id));

    // Get attendance stats
    const attendanceStats = await database
      .select({
        total: count(),
        submitted: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.SUBMITTED} THEN 1 END)`,
        late: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.LATE} THEN 1 END)`,
        absent: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.ABSENT} THEN 1 END)`,
      })
      .from(attendance)
      .where(eq(attendance.memberId, member.id));

    const attStats = attendanceStats[0] || { total: 0, submitted: 0, late: 0, absent: 0 };

    // Get recent posts
    const recentPosts = await database
      .select({
        id: posts.id,
        title: posts.title,
        url: posts.url,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.memberId, member.id))
      .orderBy(desc(posts.publishedAt))
      .limit(5);

    return NextResponse.json({
      member: {
        id: member.id,
        discordUsername: member.discordUsername,
        name: member.name,
        part: member.part,
        blogUrl: member.blogUrl,
        profileImageUrl: member.profileImageUrl,
        bio: member.bio,
        interests: member.interests,
        resolution: member.resolution,
        status: member.status,
        joinedAt: member.joinedAt,
      },
      stats: {
        postCount: postCount?.count ?? 0,
        totalRounds: attStats.total,
        submittedRounds: attStats.submitted,
        lateRounds: attStats.late,
        absentRounds: attStats.absent,
        attendanceRate: attStats.total > 0 
          ? Math.round((attStats.submitted / attStats.total) * 100) 
          : 0,
      },
      recentPosts: recentPosts.map((post) => ({
        id: post.id,
        title: post.title,
        url: post.url,
        publishedAt: post.publishedAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Member profile API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
