import { NextRequest } from 'next/server';
import { count, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors, successResponse, withCache } from '@/lib/api-error';

const { members, posts, attendance, AttendanceStatus } = sharedDb;

const ALLOWED_STATUSES = ['active', 'dormant'];

/**
 * GET /api/members
 * Get all members with basic stats
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Errors.unauthorized().toResponse();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    if (!ALLOWED_STATUSES.includes(status)) {
      return Errors.badRequest('유효하지 않은 상태입니다.').toResponse();
    }

    const database = db();

    // Get members by status
    const membersList = await database.select().from(members).where(eq(members.status, status));

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
      const attendanceRate =
        attStats.total > 0 ? Math.round((attStats.submitted / attStats.total) * 100) : 0;

      return {
        id: member.id,
        discordUsername: member.discordUsername,
        name: member.name,
        nickname: member.nickname,
        part: member.part,
        blogUrl: member.blogUrl,
        profileImageUrl: member.profileImageUrl,
        bio: member.bio,
        status: member.status,
        githubUrl: member.githubUrl,
        linkedinUrl: member.linkedinUrl,
        instagramUrl: member.instagramUrl,
        postCount,
        attendanceRate,
        joinedAt: member.joinedAt,
      };
    });

    return withCache(successResponse({ members: result, total: result.length }), 60);
  } catch (error) {
    console.error('Members API error:', error);
    return errorResponse(error);
  }
}
