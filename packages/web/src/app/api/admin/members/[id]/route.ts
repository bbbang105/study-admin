import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb, utils } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';
import { detectRssUrl } from '@/lib/rss-detect';

const { isValidBlogUrl } = utils;

const { members, MemberStatus, rounds } = sharedDb;

/**
 * GET /api/admin/members/[id]
 * Get a single member by ID
 */
export const GET = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const id = new URL(request.url).pathname.split('/').pop();
    if (!id) {
      return NextResponse.json({ message: '멤버 ID가 필요합니다.' }, { status: 400 });
    }

    const database = db();
    const [member] = await database.select().from(members).where(eq(members.id, id)).limit(1);

    if (!member) {
      return NextResponse.json({ message: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'success', member });
  } catch (error) {
    console.error('Admin get member error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
});

/**
 * PUT /api/admin/members/[id]
 * Update a member (admin only)
 * Requirement: 19.4
 */
export const PUT = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const id = new URL(request.url).pathname.split('/').pop();
    if (!id) {
      return NextResponse.json({ message: '멤버 ID가 필요합니다.' }, { status: 400 });
    }

    const body = await request.json();
    const { name, part, discordId, discordUsername, blogUrl, rssUrl, status } = body;

    const database = db();

    // Check if member exists
    const [existingMember] = await database
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    if (!existingMember) {
      return NextResponse.json({ message: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Validate required fields
    const errors: string[] = [];
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      errors.push('이름은 필수입니다.');
    }
    if (part !== undefined && (typeof part !== 'string' || part.trim().length === 0)) {
      errors.push('파트는 필수입니다.');
    }
    if (
      discordId !== undefined &&
      (typeof discordId !== 'string' || discordId.trim().length === 0)
    ) {
      errors.push('Discord ID는 필수입니다.');
    }
    if (blogUrl !== undefined && (typeof blogUrl !== 'string' || blogUrl.trim().length === 0)) {
      errors.push('블로그 URL은 필수입니다.');
    }

    // Validate blog URL format
    if (blogUrl && !isValidBlogUrl(blogUrl)) {
      errors.push('유효하지 않은 블로그 URL 형식입니다.');
    }

    // Validate status
    const validStatuses = [
      MemberStatus.PENDING_APPROVAL,
      MemberStatus.ACTIVE,
      MemberStatus.INACTIVE,
      MemberStatus.DORMANT,
      MemberStatus.OB,
      MemberStatus.WITHDRAWN,
    ];
    if (status !== undefined && !validStatuses.includes(status)) {
      errors.push('유효하지 않은 상태입니다.');
    }

    if (errors.length > 0) {
      return NextResponse.json({ message: errors.join(' '), errors }, { status: 400 });
    }

    // Check for duplicate Discord ID if changed
    if (discordId && discordId !== existingMember.discordId) {
      const [duplicateMember] = await database
        .select()
        .from(members)
        .where(eq(members.discordId, discordId))
        .limit(1);

      if (duplicateMember) {
        return NextResponse.json({ message: '이미 등록된 Discord ID입니다.' }, { status: 409 });
      }
    }

    // Build update object
    const updateData: Partial<typeof existingMember> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (part !== undefined) updateData.part = part.trim();
    if (discordId !== undefined) updateData.discordId = discordId.trim();
    if (discordUsername !== undefined) updateData.discordUsername = discordUsername.trim();
    if (blogUrl !== undefined) updateData.blogUrl = blogUrl.trim();
    if (rssUrl !== undefined) updateData.rssUrl = rssUrl?.trim() || null;
    if (status !== undefined) {
      // 휴면 전환 시 전용 로직
      if (status === MemberStatus.DORMANT) {
        // 이미 휴면을 사용한 멤버는 재사용 불가 (1회 제한)
        if (existingMember.dormantUsed) {
          return NextResponse.json(
            { message: '이미 휴면을 사용한 멤버입니다. (1회 제한)' },
            { status: 400 }
          );
        }

        // 현재 회차 조회
        const [currentRound] = await database
          .select()
          .from(rounds)
          .where(eq(rounds.isCurrent, true))
          .limit(1);

        if (!currentRound) {
          return NextResponse.json({ message: '현재 진행 중인 회차가 없습니다.' }, { status: 400 });
        }

        updateData.dormantStartRound = currentRound.roundNumber;
        updateData.dormantUsed = true;
      }

      // 휴면에서 다른 상태로 전환 시 dormantStartRound 초기화
      if (existingMember.status === MemberStatus.DORMANT && status !== MemberStatus.DORMANT) {
        updateData.dormantStartRound = null;
      }

      updateData.status = status;
    }

    // RSS URL 자동 감지: rssUrl이 비어있고 blogUrl이 있으면 감지 시도
    const targetBlogUrl = updateData.blogUrl ?? existingMember.blogUrl;
    if (!updateData.rssUrl && targetBlogUrl) {
      updateData.rssUrl = await detectRssUrl(targetBlogUrl);
    }

    // Update member
    const [updatedMember] = await database
      .update(members)
      .set(updateData)
      .where(eq(members.id, id))
      .returning();

    return NextResponse.json({
      message: '멤버 정보가 수정되었습니다.',
      member: updatedMember,
    });
  } catch (error) {
    console.error('Admin update member error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
});

/**
 * DELETE /api/admin/members/[id]
 * Soft delete a member (mark as withdrawn)
 * Requirements: 19.5, 19.6
 */
export const DELETE = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const id = new URL(request.url).pathname.split('/').pop();
    if (!id) {
      return NextResponse.json({ message: '멤버 ID가 필요합니다.' }, { status: 400 });
    }

    const database = db();

    // Check if member exists
    const [existingMember] = await database
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    if (!existingMember) {
      return NextResponse.json({ message: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Soft delete: mark as withdrawn (Requirement: 19.6)
    const [deletedMember] = await database
      .update(members)
      .set({
        status: MemberStatus.WITHDRAWN,
        updatedAt: new Date(),
      })
      .where(eq(members.id, id))
      .returning();

    return NextResponse.json({
      message: '멤버가 탈퇴 처리되었습니다.',
      member: deletedMember,
    });
  } catch (error) {
    console.error('Admin delete member error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
});
