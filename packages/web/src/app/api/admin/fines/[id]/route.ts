import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';
import { errorResponse, Errors } from '@/lib/api-error';

const { fines, FineStatus, FineType } = sharedDb;

/**
 * PATCH /api/admin/fines/[id]
 * Update fine status (mark as paid or waived)
 * Requirements: 16.8, 16.9
 */
export const PATCH = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return Errors.badRequest('벌금 ID가 필요합니다.').toResponse();
    }

    const body = await request.json();
    const { status, type } = body;

    // status 또는 type 중 하나는 있어야 함
    if (!status && !type) {
      return Errors.badRequest('status 또는 type이 필요합니다.').toResponse();
    }

    // Validate status
    if (status && ![FineStatus.UNPAID, FineStatus.PAID, FineStatus.WAIVED].includes(status)) {
      return Errors.badRequest('유효하지 않은 상태입니다. (PENDING, PAID, WAIVED 중 하나여야 합니다.)').toResponse();
    }

    // Validate type
    const validTypes = [FineType.LATE, FineType.ABSENT];
    if (type && !validTypes.includes(type)) {
      return Errors.badRequest('유효하지 않은 유형입니다. (late, absent 중 하나여야 합니다.)').toResponse();
    }

    const database = db();

    // Check if fine exists
    const [existingFine] = await database.select().from(fines).where(eq(fines.id, id)).limit(1);

    if (!existingFine) {
      return Errors.notFound('벌금을 찾을 수 없습니다.').toResponse();
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
      if (status === FineStatus.PAID) {
        updateData.paidAt = new Date();
      }
    }

    if (type) {
      const fineAmounts: Record<string, number> = {
        [FineType.LATE]: 3000,
        [FineType.ABSENT]: 5000,
      };
      updateData.type = type;
      updateData.amount = fineAmounts[type];
    }

    const [updatedFine] = await database
      .update(fines)
      .set(updateData)
      .where(eq(fines.id, id))
      .returning();

    if (!updatedFine) {
      return Errors.internalError('벌금 업데이트에 실패했습니다.').toResponse();
    }

    let message = '벌금이 수정되었습니다.';
    if (status && !type) {
      const messageMap: Record<string, string> = {
        [FineStatus.PAID]: '납부 처리되었습니다.',
        [FineStatus.WAIVED]: '면제 처리되었습니다.',
        [FineStatus.UNPAID]: '미납으로 되돌렸습니다.',
      };
      message = messageMap[status] ?? message;
    }
    if (type) {
      const typeLabel = type === FineType.LATE ? '지각' : '결석';
      message = `${typeLabel}(${updatedFine.amount.toLocaleString()}원)으로 변경되었습니다.`;
    }

    return NextResponse.json({
      message,
      fine: {
        id: updatedFine.id,
        type: updatedFine.type,
        amount: updatedFine.amount,
        status: updatedFine.status,
        paidAt: updatedFine.paidAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin fine update API error:', error);
    return errorResponse(error);
  }
});
