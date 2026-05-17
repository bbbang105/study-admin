import { NextRequest } from 'next/server';
import { asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors, successResponse, withCache } from '@/lib/api-error';
import { getAdminDiscordIds } from '@/lib/admin';

const { members, memberBlogs, posts, attendance, AttendanceStatus } = sharedDb;

const ALLOWED_STATUSES = ['active', 'dormant', 'ob'];

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
    const statusParam = searchParams.get('status') || 'active';

    // 쉼표 구분으로 복수 상태 지원: ?status=active,dormant,ob
    const statuses = statusParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.some((s) => !ALLOWED_STATUSES.includes(s))) {
      return Errors.badRequest('유효하지 않은 상태입니다.').toResponse();
    }

    const database = db();

    // Get members by status(es)
    const membersList = await database
      .select()
      .from(members)
      .where(
        statuses.length === 1 ? eq(members.status, statuses[0]!) : inArray(members.status, statuses)
      );

    // Get blogs for listed members
    const memberIds = membersList.map((m) => m.id);
    const blogRows =
      memberIds.length > 0
        ? await database
            .select({
              memberId: memberBlogs.memberId,
              id: memberBlogs.id,
              label: memberBlogs.label,
              blogUrl: memberBlogs.blogUrl,
              sortOrder: memberBlogs.sortOrder,
            })
            .from(memberBlogs)
            .where(inArray(memberBlogs.memberId, memberIds))
            .orderBy(asc(memberBlogs.sortOrder))
        : [];
    const blogMap = new Map<string, { id: string; label: string | null; blogUrl: string }[]>();
    for (const b of blogRows) {
      const list = blogMap.get(b.memberId) ?? [];
      list.push({ id: b.id, label: b.label, blogUrl: b.blogUrl });
      blogMap.set(b.memberId, list);
    }

    // Get post counts for all members (soft deleted 제외)
    const postCounts = await database
      .select({
        memberId: posts.memberId,
        count: count(),
      })
      .from(posts)
      .where(isNull(posts.deletedAt))
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

    const adminDiscordIds = await getAdminDiscordIds();

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
        blogs: blogMap.get(member.id) ?? [],
        profileImageUrl: member.profileImageUrl,
        bio: member.bio,
        status: member.status,
        githubUrl: member.githubUrl,
        linkedinUrl: member.linkedinUrl,
        instagramUrl: member.instagramUrl,
        postCount,
        attendanceRate,
        joinedAt: member.joinedAt,
        isAdmin: adminDiscordIds.includes(member.discordId),
      };
    });

    result.sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });

    return withCache(successResponse({ members: result, total: result.length }), 60);
  } catch (error) {
    console.error('Members API error:', error);
    return errorResponse(error);
  }
}
