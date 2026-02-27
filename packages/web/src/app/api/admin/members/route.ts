import { NextRequest, NextResponse } from 'next/server';
import { eq, count, sql, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';
import { utils } from '@blog-study/shared';
import { detectRssUrl } from '@/lib/rss-detect';

const { isValidBlogUrl } = utils;

const { members, posts, attendance, AttendanceStatus, MemberStatus } = sharedDb;

/**
 * GET /api/admin/members
 * Get all members with stats for admin management
 * Requirements: 16.5, 19.7
 */
export const GET = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const database = db();

    // Build query
    let query = database.select().from(members);
    
    if (status && status !== 'all') {
      query = query.where(eq(members.status, status)) as typeof query;
    }

    const membersList = await query.orderBy(asc(members.name));

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
        late: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.LATE} THEN 1 END)`,
        absent: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.ABSENT} THEN 1 END)`,
      })
      .from(attendance)
      .groupBy(attendance.memberId);

    // Create maps for quick lookup
    const postCountMap = new Map(postCounts.map((p) => [p.memberId, p.count]));
    const attendanceMap = new Map(
      attendanceStats.map((a) => [
        a.memberId,
        { total: a.total, submitted: a.submitted, late: a.late, absent: a.absent },
      ])
    );

    // Group members by status
    const groupedMembers: Record<string, typeof result> = {
      pending_approval: [],
      active: [],
      inactive: [],
      dormant: [],
      ob: [],
      withdrawn: [],
    };

    const result = membersList.map((member) => {
      const postCount = postCountMap.get(member.id) || 0;
      const attStats = attendanceMap.get(member.id) || { total: 0, submitted: 0, late: 0, absent: 0 };
      const attendanceRate =
        attStats.total > 0 ? Math.round((attStats.submitted / attStats.total) * 100) : 0;

      return {
        id: member.id,
        discordId: member.discordId,
        discordUsername: member.discordUsername,
        name: member.name,
        nickname: member.nickname,
        part: member.part,
        blogUrl: member.blogUrl,
        rssUrl: member.rssUrl,
        profileImageUrl: member.profileImageUrl,
        bio: member.bio,
        interests: member.interests,
        resolution: member.resolution,
        rssConsent: member.rssConsent ?? true,
        status: member.status,
        onboardingCompleted: member.onboardingCompleted,
        dormantUsed: member.dormantUsed,
        dormantStartRound: member.dormantStartRound,
        postCount,
        attendanceRate,
        attendanceStats: attStats,
        joinedAt: member.joinedAt?.toISOString(),
        updatedAt: member.updatedAt?.toISOString(),
      };
    });

    // Group by status
    result.forEach((member) => {
      const status = member.status;
      if (groupedMembers[status]) {
        groupedMembers[status].push(member);
      }
    });

    return NextResponse.json({
      members: result,
      grouped: groupedMembers,
      counts: {
        pending_approval: groupedMembers.pending_approval.length,
        active: groupedMembers.active.length,
        inactive: groupedMembers.inactive.length,
        dormant: groupedMembers.dormant.length,
        ob: groupedMembers.ob.length,
        withdrawn: groupedMembers.withdrawn.length,
        total: result.length,
      },
    });
  } catch (error) {
    console.error('Admin members API error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
});

/**
 * POST /api/admin/members
 * Create a new member (admin only)
 * Requirements: 19.1, 19.2, 19.3
 */
export const POST = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const body = await request.json();
    const { name, part, discordId, discordUsername, blogUrl, rssUrl } = body;

    // Validate required fields (Requirement: 19.2)
    const errors: string[] = [];
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push('이름은 필수입니다.');
    }
    if (!part || typeof part !== 'string' || part.trim().length === 0) {
      errors.push('파트는 필수입니다.');
    }
    if (!discordId || typeof discordId !== 'string' || discordId.trim().length === 0) {
      errors.push('Discord ID는 필수입니다.');
    }
    if (!blogUrl || typeof blogUrl !== 'string' || blogUrl.trim().length === 0) {
      errors.push('블로그 URL은 필수입니다.');
    }

    // Validate blog URL format
    if (blogUrl && !isValidBlogUrl(blogUrl)) {
      errors.push('유효하지 않은 블로그 URL 형식입니다.');
    }

    if (errors.length > 0) {
      return NextResponse.json({ message: errors.join(' '), errors }, { status: 400 });
    }

    const database = db();

    // Check for duplicate Discord ID
    const [existingMember] = await database
      .select()
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (existingMember) {
      return NextResponse.json(
        { message: '이미 등록된 Discord ID입니다.' },
        { status: 409 }
      );
    }

    // RSS URL 자동 감지 (비어있으면 blogUrl로부터 감지 시도)
    let resolvedRssUrl = rssUrl?.trim() || null;
    if (!resolvedRssUrl && blogUrl) {
      resolvedRssUrl = await detectRssUrl(blogUrl.trim());
    }

    // Create member (Requirement: 19.3)
    const [newMember] = await database
      .insert(members)
      .values({
        name: name.trim(),
        nickname: name.trim(),
        part: part.trim(),
        discordId: discordId.trim(),
        discordUsername: discordUsername?.trim() || discordId.trim(),
        blogUrl: blogUrl.trim(),
        rssUrl: resolvedRssUrl,
        status: MemberStatus.ACTIVE,
      })
      .returning();

    return NextResponse.json({
      message: '멤버가 등록되었습니다.',
      member: newMember,
    });
  } catch (error) {
    console.error('Admin create member error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
});
