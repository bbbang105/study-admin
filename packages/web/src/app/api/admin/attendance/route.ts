import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';
import { Errors, successResponse } from '@/lib/api-error';

const { members, rounds, attendance, fines, AttendanceStatus, FineStatus, FineType } = sharedDb;

/**
 * GET /api/admin/attendance
 * Get attendance grid data (members × rounds)
 * Requirement: 16.6
 */
export const GET = withAdminAuth(async (_request, _adminAuth) => {
  try {
    const database = db();

    // Get all rounds ordered by round number
    const allRounds = await database.select().from(rounds).orderBy(asc(rounds.roundNumber));

    // Get all members (excluding withdrawn for cleaner view, but include all for completeness)
    const allMembers = await database
      .select({
        id: members.id,
        name: members.name,
        discordUsername: members.discordUsername,
        part: members.part,
        status: members.status,
      })
      .from(members)
      .orderBy(asc(members.name));

    // Get all attendance records
    const allAttendance = await database
      .select({
        id: attendance.id,
        memberId: attendance.memberId,
        roundId: attendance.roundId,
        status: attendance.status,
        submittedAt: attendance.submittedAt,
        updatedAt: attendance.updatedAt,
      })
      .from(attendance);

    // Create a map for quick lookup: memberId-roundId -> attendance
    const attendanceMap = new Map<string, (typeof allAttendance)[0]>();
    for (const att of allAttendance) {
      const key = `${att.memberId}-${att.roundId}`;
      attendanceMap.set(key, att);
    }

    // Build the grid data
    const grid = allMembers.map((member) => {
      const memberAttendance: Record<
        number,
        {
          id: string | null;
          status: string;
          submittedAt: string | null;
        }
      > = {};

      for (const round of allRounds) {
        const key = `${member.id}-${round.id}`;
        const att = attendanceMap.get(key);
        memberAttendance[round.id] = {
          id: att?.id || null,
          status: att?.status || 'none',
          submittedAt: att?.submittedAt?.toISOString() || null,
        };
      }

      return {
        member: {
          id: member.id,
          name: member.name,
          discordUsername: member.discordUsername,
          part: member.part,
          status: member.status,
        },
        attendance: memberAttendance,
      };
    });

    // Calculate statistics per round
    const roundStats = allRounds.map((round) => {
      const roundAttendance = allAttendance.filter((a) => a.roundId === round.id);
      const total = roundAttendance.length;
      const submitted = roundAttendance.filter(
        (a) => a.status === AttendanceStatus.SUBMITTED
      ).length;
      const late = roundAttendance.filter((a) => a.status === AttendanceStatus.LATE).length;
      const absent = roundAttendance.filter((a) => a.status === AttendanceStatus.ABSENT).length;
      const pending = roundAttendance.filter((a) => a.status === AttendanceStatus.PENDING).length;

      return {
        roundId: round.id,
        roundNumber: round.roundNumber,
        startDate: round.startDate,
        endDate: round.endDate,
        isCurrent: round.isCurrent,
        stats: {
          total,
          submitted,
          late,
          absent,
          pending,
          submissionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
        },
      };
    });

    return NextResponse.json({
      rounds: allRounds.map((r) => ({
        id: r.id,
        roundNumber: r.roundNumber,
        startDate: r.startDate,
        endDate: r.endDate,
        graceEndDate: r.graceEndDate,
        isCurrent: r.isCurrent,
      })),
      grid,
      roundStats,
    });
  } catch (error) {
    console.error('Admin attendance API error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
});

/**
 * POST /api/admin/attendance
 * Create attendance record for a member + round (when none exists)
 */
export const POST = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const body = await request.json();
    const { memberId, roundId, status } = body;

    if (!memberId || !roundId || !status) {
      return Errors.badRequest('memberId, roundId, status가 필요합니다.').toResponse();
    }

    const validStatuses = [
      AttendanceStatus.PENDING,
      AttendanceStatus.SUBMITTED,
      AttendanceStatus.LATE,
      AttendanceStatus.ABSENT,
    ];
    if (!validStatuses.includes(status)) {
      return Errors.badRequest('유효하지 않은 상태입니다.').toResponse();
    }

    const database = db();
    const now = new Date();

    // Check if record already exists
    const [existing] = await database
      .select()
      .from(attendance)
      .where(and(eq(attendance.memberId, memberId), eq(attendance.roundId, roundId)))
      .limit(1);

    if (existing) {
      return Errors.conflict('이미 출석 기록이 존재합니다.').toResponse();
    }

    // Create attendance record
    const [created] = await database
      .insert(attendance)
      .values({
        memberId,
        roundId,
        status,
        submittedAt:
          status === AttendanceStatus.SUBMITTED || status === AttendanceStatus.LATE ? now : null,
        updatedAt: now,
      })
      .returning();

    // Create fine if late/absent
    if (status === AttendanceStatus.LATE || status === AttendanceStatus.ABSENT) {
      const fineAmount = status === AttendanceStatus.LATE ? 3000 : 5000;
      const fineType = status === AttendanceStatus.LATE ? FineType.LATE : FineType.ABSENT;

      await database.insert(fines).values({
        memberId,
        roundId,
        type: fineType,
        amount: fineAmount,
        status: FineStatus.UNPAID,
      });
    }

    if (!created) {
      return Errors.internalError('출석 기록 생성에 실패했습니다.').toResponse();
    }

    return successResponse(
      {
        attendance: {
          id: created.id,
          status: created.status,
          submittedAt: created.submittedAt?.toISOString(),
        },
      },
      '출석 기록이 생성되었습니다.'
    );
  } catch (error) {
    console.error('Admin create attendance error:', error);
    return Errors.internalError().toResponse();
  }
});
