import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';

const { fines, FineStatus } = sharedDb;

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
      return NextResponse.json(
        { message: '벌금 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!status || ![FineStatus.PAID, FineStatus.WAIVED].includes(status)) {
      return NextResponse.json(
        { message: '유효하지 않은 상태입니다. (paid 또는 waived만 가능)' },
        { status: 400 }
      );
    }

    const database = db();

    // Check if fine exists
    const [existingFine] = await database
      .select()
      .from(fines)
      .where(eq(fines.id, id))
      .limit(1);

    if (!existingFine) {
      return NextResponse.json(
        { message: '벌금을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Update fine status
    const updateData: { status: string; paidAt?: Date } = { status };
    
    // Set paidAt timestamp if marking as paid
    if (status === FineStatus.PAID) {
      updateData.paidAt = new Date();
    }

    const [updatedFine] = await database
      .update(fines)
      .set(updateData)
      .where(eq(fines.id, id))
      .returning();

    if (!updatedFine) {
      return NextResponse.json(
        { message: '벌금 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: status === FineStatus.PAID ? '납부 처리되었습니다.' : '면제 처리되었습니다.',
      fine: {
        id: updatedFine.id,
        status: updatedFine.status,
        paidAt: updatedFine.paidAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin fine update API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
