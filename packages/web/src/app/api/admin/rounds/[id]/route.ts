import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';
import { Errors, successResponse, errorResponse } from '@/lib/api-error';

const { rounds } = sharedDb;

/**
 * GET /api/admin/rounds/[id]
 * Get a single round by ID
 */
export const GET = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return Errors.badRequest('회차 ID가 필요합니다.').toResponse();
    }

    const database = db();
    const [round] = await database
      .select()
      .from(rounds)
      .where(eq(rounds.id, parseInt(id, 10)))
      .limit(1);

    if (!round) {
      return Errors.notFound('회차를 찾을 수 없습니다.').toResponse();
    }

    return successResponse({ round });
  } catch (error) {
    console.error('Admin get round error:', error);
    return errorResponse(error);
  }
});

/**
 * PATCH /api/admin/rounds/[id]
 * Update a round (set as current, update dates)
 */
export const PATCH = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return Errors.badRequest('회차 ID가 필요합니다.').toResponse();
    }

    const body = await request.json();
    const { isCurrent, startDate, endDate, graceEndDate } = body;

    const database = db();

    // Check if round exists
    const [existingRound] = await database
      .select()
      .from(rounds)
      .where(eq(rounds.id, parseInt(id, 10)))
      .limit(1);

    if (!existingRound) {
      return Errors.notFound('회차를 찾을 수 없습니다.').toResponse();
    }

    // Build update object
    const updateData: Partial<typeof existingRound> = {};

    if (startDate !== undefined) {
      updateData.startDate = startDate;
    }
    if (endDate !== undefined) {
      updateData.endDate = endDate;
    }
    if (graceEndDate !== undefined) {
      updateData.graceEndDate = graceEndDate;
    }

    // If setting as current, unset all other rounds first
    if (isCurrent === true) {
      await database
        .update(rounds)
        .set({ isCurrent: false })
        .where(eq(rounds.isCurrent, true));
      updateData.isCurrent = true;
    } else if (isCurrent === false) {
      updateData.isCurrent = false;
    }

    // Update round
    const [updatedRound] = await database
      .update(rounds)
      .set(updateData)
      .where(eq(rounds.id, parseInt(id, 10)))
      .returning();

    return successResponse(
      { round: updatedRound },
      '회차가 수정되었습니다.'
    );
  } catch (error) {
    console.error('Admin update round error:', error);
    return errorResponse(error);
  }
});

/**
 * DELETE /api/admin/rounds/[id]
 * Delete a round (use with caution)
 */
export const DELETE = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return Errors.badRequest('회차 ID가 필요합니다.').toResponse();
    }

    const database = db();

    // Check if round exists
    const [existingRound] = await database
      .select()
      .from(rounds)
      .where(eq(rounds.id, parseInt(id, 10)))
      .limit(1);

    if (!existingRound) {
      return Errors.notFound('회차를 찾을 수 없습니다.').toResponse();
    }

    // Delete round (cascade will handle related records)
    await database
      .delete(rounds)
      .where(eq(rounds.id, parseInt(id, 10)));

    return successResponse(
      { deleted: true },
      '회차가 삭제되었습니다.'
    );
  } catch (error) {
    console.error('Admin delete round error:', error);
    return errorResponse(error);
  }
});
