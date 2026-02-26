import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { withAdminAuth } from '@/lib/admin';
import { getTodayKST, sanitizeDescription } from '@/lib/sanitize';

const { activityScores, members, ActivityScoreType } = sharedDb;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POINTS = 1000;

/**
 * POST /api/admin/scores
 * 관리자 수동 점수 부여/차감
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { memberId, points, description } = body;

    // 필수값 검증
    if (!memberId || points === undefined || !description) {
      throw Errors.badRequest('memberId, points, description은 필수입니다.');
    }

    // memberId UUID 형식 검증
    if (typeof memberId !== 'string' || !UUID_REGEX.test(memberId)) {
      throw Errors.badRequest('유효하지 않은 memberId 형식입니다.');
    }

    // points 정수 + 범위 검증
    if (!Number.isInteger(points) || points === 0) {
      throw Errors.badRequest('points는 0이 아닌 정수여야 합니다.');
    }
    if (Math.abs(points) > MAX_POINTS) {
      throw Errors.badRequest(`points는 ±${MAX_POINTS} 범위여야 합니다.`);
    }

    // description 검증 + 새니타이즈
    if (typeof description !== 'string' || description.trim().length === 0) {
      throw Errors.badRequest('description은 비어있을 수 없습니다.');
    }
    const sanitizedDesc = sanitizeDescription(description);
    if (sanitizedDesc.length > 300) {
      throw Errors.badRequest('description은 300자 이하여야 합니다.');
    }

    const database = db();

    // 멤버 존재 여부 확인
    const [member] = await database
      .select({ id: members.id })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);

    if (!member) {
      throw Errors.badRequest('존재하지 않는 멤버입니다.');
    }

    const today = getTodayKST();

    const [record] = await database
      .insert(activityScores)
      .values({
        memberId,
        type: ActivityScoreType.ADMIN_MANUAL,
        points,
        description: sanitizedDesc,
        date: today,
      })
      .returning();

    return successResponse(record, '점수가 부여되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
});
