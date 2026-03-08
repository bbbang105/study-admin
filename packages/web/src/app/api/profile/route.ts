import { NextResponse } from 'next/server';
import { count, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors } from '@/lib/api-error';

const { members, posts, attendance, fines, AttendanceStatus, FineStatus } = sharedDb;

/**
 * GET /api/profile
 * Supabase Auth → Discord ID → members 테이블 + 통계
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return Errors.unauthorized().toResponse();
    }

    const discordIdentity = user.identities?.find((identity) => identity.provider === 'discord');
    const discordId = discordIdentity?.id as string | undefined;
    let memberData = null;
    let stats = null;

    if (discordId) {
      const database = db();
      const [member] = await database
        .select()
        .from(members)
        .where(eq(members.discordId, discordId))
        .limit(1);

      if (member) {
        memberData = member;

        const [postCount] = await database
          .select({ count: count() })
          .from(posts)
          .where(eq(posts.memberId, member.id));

        const attendanceStats = await database
          .select({
            total: count(),
            submitted: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.SUBMITTED} THEN 1 END)`,
            late: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.LATE} THEN 1 END)`,
            absent: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.ABSENT} THEN 1 END)`,
          })
          .from(attendance)
          .where(eq(attendance.memberId, member.id));

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
          attendanceRate:
            attStats.total > 0 ? Math.round((attStats.submitted / attStats.total) * 100) : 0,
          totalFines: fStats.totalFines,
          unpaidFines: fStats.unpaidFines,
        };
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        discordUsername: user.user_metadata?.full_name,
        avatarUrl: user.user_metadata?.avatar_url,
        memberId: memberData?.id ?? null,
      },
      member: memberData
        ? {
            id: memberData.id,
            discordId: memberData.discordId,
            discordUsername: memberData.discordUsername,
            name: memberData.name,
            nickname: memberData.nickname,
            part: memberData.part,
            blogUrl: memberData.blogUrl,
            rssUrl: memberData.rssUrl,
            profileImageUrl: memberData.profileImageUrl,
            bio: memberData.bio,
            interests: memberData.interests,
            resolution: memberData.resolution,
            rssConsent: memberData.rssConsent ?? true,
            onboardingCompleted: memberData.onboardingCompleted,
            status: memberData.status,
            dormantUsed: memberData.dormantUsed,
            joinedAt: memberData.joinedAt,
            githubUrl: memberData.githubUrl,
            linkedinUrl: memberData.linkedinUrl,
            instagramUrl: memberData.instagramUrl,
          }
        : null,
      stats,
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return errorResponse(error);
  }
}
