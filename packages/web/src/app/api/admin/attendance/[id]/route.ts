import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';
import { Errors, successResponse, errorResponse } from '@/lib/api-error';

const { attendance, members, rounds, fines, AttendanceStatus, FineStatus, FineType } = sharedDb;

/**
 * GET /api/admin/attendance/[id]
 * Get a single attendance record
 */
export const GET = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return Errors.badRequest('출석 ID가 필요합니다.').toResponse();
    }

    const database = db();
    const [record] = await database
      .select({
        id: attendance.id,
        memberId: attendance.memberId,
        roundId: attendance.roundId,
        status: attendance.status,
        submittedAt: attendance.submittedAt,
        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt,
        memberName: members.name,
        memberDiscordUsername: members.discordUsername,
        roundNumber: rounds.roundNumber,
      })
      .from(attendance)
      .leftJoin(members, eq(attendance.memberId, members.id))
      .leftJoin(rounds, eq(attendance.roundId, rounds.id))
      .where(eq(attendance.id, id))
      .limit(1);

    if (!record) {
      return Errors.notFound('출석 기록을 찾을 수 없습니다.').toResponse();
    }

    return successResponse({
      attendance: {
        id: record.id,
        memberId: record.memberId,
        roundId: record.roundId,
        status: record.status,
        submittedAt: record.submittedAt?.toISOString(),
        createdAt: record.createdAt?.toISOString(),
        updatedAt: record.updatedAt?.toISOString(),
        memberName: record.memberName,
        memberDiscordUsername: record.memberDiscordUsername,
        roundNumber: record.roundNumber,
      },
    });
  } catch (error) {
    console.error('Admin get attendance error:', error);
    return errorResponse(error);
  }
});

/**
 * PATCH /api/admin/attendance/[id]
 * Update attendance status (admin only)
 * Requirement: 15.6 - /출석수정 [유저] [회차] [상태]
 */
export const PATCH = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return Errors.badRequest('출석 ID가 필요합니다.').toResponse();
    }

    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = [
      AttendanceStatus.PENDING,
      AttendanceStatus.SUBMITTED,
      AttendanceStatus.LATE,
      AttendanceStatus.ABSENT,
    ];

    if (!status || !validStatuses.includes(status)) {
      return Errors.badRequest(
        `유효하지 않은 상태입니다. (${validStatuses.join(', ')} 중 하나여야 합니다.)`
      ).toResponse();
    }

    const database = db();

    // Check if attendance record exists
    const [existingRecord] = await database
      .select()
      .from(attendance)
      .where(eq(attendance.id, id))
      .limit(1);

    if (!existingRecord) {
      return Errors.notFound('출석 기록을 찾을 수 없습니다.').toResponse();
    }

    const previousStatus = existingRecord.status;
    const now = new Date();

    // Update attendance status
    const [updatedRecord] = await database
      .update(attendance)
      .set({
        status,
        submittedAt: status === AttendanceStatus.SUBMITTED || status === AttendanceStatus.LATE
          ? existingRecord.submittedAt || now
          : null,
        updatedAt: now,
      })
      .where(eq(attendance.id, id))
      .returning();

    // Handle fine creation/removal based on status change
    // If changing TO late/absent, create fine if not exists
    // If changing FROM late/absent to submitted/pending, remove fine
    
    if (status === AttendanceStatus.LATE || status === AttendanceStatus.ABSENT) {
      // Check if fine already exists for this member and round
      const [existingFine] = await database
        .select()
        .from(fines)
        .where(
          and(
            eq(fines.memberId, existingRecord.memberId),
            eq(fines.roundId, existingRecord.roundId)
          )
        )
        .limit(1);

      if (!existingFine) {
        // Create fine
        const fineAmount = status === AttendanceStatus.LATE ? 3000 : 5000;
        const fineType = status === AttendanceStatus.LATE ? FineType.LATE : FineType.ABSENT;

        await database.insert(fines).values({
          memberId: existingRecord.memberId,
          roundId: existingRecord.roundId,
          type: fineType,
          amount: fineAmount,
          status: FineStatus.UNPAID,
        });
      } else if (existingFine.status === FineStatus.UNPAID || existingFine.status === FineStatus.WAIVED) {
        // Update existing fine type/amount + WAIVED면 UNPAID로 복원
        const fineAmount = status === AttendanceStatus.LATE ? 3000 : 5000;
        const fineType = status === AttendanceStatus.LATE ? FineType.LATE : FineType.ABSENT;

        await database
          .update(fines)
          .set({
            type: fineType,
            amount: fineAmount,
            status: FineStatus.UNPAID,
          })
          .where(eq(fines.id, existingFine.id));
      }
    } else if (
      (previousStatus === AttendanceStatus.LATE || previousStatus === AttendanceStatus.ABSENT) &&
      (status === AttendanceStatus.SUBMITTED || status === AttendanceStatus.PENDING)
    ) {
      // Remove unpaid fine if status changed from late/absent to submitted/pending
      const [existingFine] = await database
        .select()
        .from(fines)
        .where(
          and(
            eq(fines.memberId, existingRecord.memberId),
            eq(fines.roundId, existingRecord.roundId),
            eq(fines.status, FineStatus.UNPAID)
          )
        )
        .limit(1);

      if (existingFine) {
        // Mark as waived instead of deleting to preserve history
        await database
          .update(fines)
          .set({ status: FineStatus.WAIVED })
          .where(eq(fines.id, existingFine.id));
      }
    }

    if (!updatedRecord) {
      return Errors.internalError('출석 상태 업데이트에 실패했습니다.').toResponse();
    }

    return successResponse(
      {
        attendance: {
          id: updatedRecord.id,
          status: updatedRecord.status,
          submittedAt: updatedRecord.submittedAt?.toISOString(),
          updatedAt: updatedRecord.updatedAt?.toISOString(),
        },
      },
      '출석 상태가 수정되었습니다.'
    );
  } catch (error) {
    console.error('Admin update attendance error:', error);
    return errorResponse(error);
  }
});
