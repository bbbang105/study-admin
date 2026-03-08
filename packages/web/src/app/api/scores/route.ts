import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';
import { isAdminDiscordId } from '@/lib/admin';

const { activityScores, members } = sharedDb;

/**
 * GET /api/scores?memberId=xxx&limit=50&offset=0
 * 점수 내역 조회
 * - memberId 없으면 → 현재 로그인 유저의 점수 내역
 * - memberId 있으면 → 본인 것만 허용 (관리자는 아무나 조회 가능)
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
    let memberId = searchParams.get('memberId');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

    const database = db();

    // 현재 유저의 Discord ID → memberId 확인
    const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
    const discordId = discordIdentity?.id ?? null;

    let currentUserMemberId: string | null = null;
    if (discordId) {
      const [member] = await database
        .select({ id: members.id })
        .from(members)
        .where(eq(members.discordId, discordId))
        .limit(1);
      currentUserMemberId = member?.id ?? null;
    }

    if (!memberId) {
      // memberId 미제공 → 본인 점수
      memberId = currentUserMemberId;
    } else if (memberId !== currentUserMemberId) {
      // 타인의 점수 → 관리자만 허용
      const isAdmin = discordId ? await isAdminDiscordId(discordId) : false;
      if (!isAdmin) {
        return NextResponse.json({ message: '자신의 점수만 조회할 수 있습니다.' }, { status: 403 });
      }
    }

    if (!memberId) {
      return successResponse({ records: [], total: 0, totalScore: 0 });
    }

    // 점수 내역
    const records = await database
      .select()
      .from(activityScores)
      .where(eq(activityScores.memberId, memberId))
      .orderBy(desc(activityScores.createdAt))
      .limit(limit)
      .offset(offset);

    // 총 개수
    const countResult = await database
      .select({ count: sql<number>`COUNT(*)` })
      .from(activityScores)
      .where(eq(activityScores.memberId, memberId));

    // 총점
    const scoreResult = await database
      .select({ total: sql<number>`COALESCE(SUM(${activityScores.points}), 0)` })
      .from(activityScores)
      .where(eq(activityScores.memberId, memberId));

    return successResponse({
      records,
      total: Number(countResult[0]?.count ?? 0),
      totalScore: Number(scoreResult[0]?.total ?? 0),
    });
  } catch (error) {
    console.error('Scores API error:', error);
    return errorResponse(error);
  }
}
