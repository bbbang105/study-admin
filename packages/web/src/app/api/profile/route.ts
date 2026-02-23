import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq, count, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { verifyToken } from '@/lib/auth';

const { users, members, posts, attendance, fines, AttendanceStatus, FineStatus } = sharedDb;

/**
 * GET /api/profile
 * Get current user's profile with linked member info
 * Requirement: 18.5, 18.6
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const payload = verifyToken(authToken);
    if (!payload) {
      return NextResponse.json(
        { message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const database = db();
    const [userData] = await database
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!userData) {
      return NextResponse.json(
        { message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let memberData = null;
    let stats = null;

    // If user is linked to a member, get member info and stats
    if (userData.memberId) {
      const [member] = await database
        .select()
        .from(members)
        .where(eq(members.id, userData.memberId))
        .limit(1);

      if (member) {
        memberData = member;

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

        // Get fine stats
        const fineStats = await database
          .select({
            totalFines: sql<number>`COALESCE(SUM(${fines.amount}), 0)`,
            unpaidFines: sql<number>`COALESCE(SUM(CASE WHEN ${fines.status} = ${FineStatus.UNPAID} THEN ${fines.amount} ELSE 0 END), 0)`,
          })
          .from(fines)
          .where(eq(fines.memberId, member.id));

        const attStats = attendanceStats[0] || { total: 0, submitted: 0, late: 0, absent: 0 };
        const fStats = fineStats[0] || { totalFines: 0, unpaidFines: 0 };

        stats = {
          postCount: postCount?.count ?? 0,
          totalRounds: attStats.total,
          submittedRounds: attStats.submitted,
          lateRounds: attStats.late,
          absentRounds: attStats.absent,
          attendanceRate: attStats.total > 0 
            ? Math.round((attStats.submitted / attStats.total) * 100) 
            : 0,
          totalFines: fStats.totalFines,
          unpaidFines: fStats.unpaidFines,
        };
      }
    }

    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        emailVerified: userData.emailVerified,
        memberId: userData.memberId,
      },
      member: memberData ? {
        id: memberData.id,
        discordId: memberData.discordId,
        discordUsername: memberData.discordUsername,
        name: memberData.name,
        part: memberData.part,
        blogUrl: memberData.blogUrl,
        rssUrl: memberData.rssUrl,
        profileImageUrl: memberData.profileImageUrl,
        bio: memberData.bio,
        interests: memberData.interests,
        resolution: memberData.resolution,
        onboardingCompleted: memberData.onboardingCompleted,
        status: memberData.status,
        dormantUsed: memberData.dormantUsed,
        joinedAt: memberData.joinedAt,
      } : null,
      stats,
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
