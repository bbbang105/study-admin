import { NextRequest } from 'next/server';
import { eq, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';
import { Errors, successResponse, errorResponse } from '@/lib/api-error';
import { utils } from '@blog-study/shared';

const { calculateRoundDates } = utils;
const { rounds, attendance, MemberStatus, members, AttendanceStatus } = sharedDb;

/**
 * GET /api/admin/rounds
 * Get all rounds with detailed statistics for admin
 */
export const GET = withAdminAuth(async (_request, _adminAuth) => {
  try {
    const database = db();

    // Get all rounds
    const allRounds = await database
      .select()
      .from(rounds)
      .orderBy(asc(rounds.roundNumber));

    // Get attendance stats per round
    const attendanceStats = await database
      .select({
        roundId: attendance.roundId,
        total: sql<number>`count(*)::int`,
        submitted: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.SUBMITTED} THEN 1 END)::int`,
        late: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.LATE} THEN 1 END)::int`,
        absent: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.ABSENT} THEN 1 END)::int`,
        pending: sql<number>`COUNT(CASE WHEN ${attendance.status} = ${AttendanceStatus.PENDING} THEN 1 END)::int`,
      })
      .from(attendance)
      .groupBy(attendance.roundId);

    const statsMap = new Map(
      attendanceStats.map((s) => [
        s.roundId,
        {
          total: s.total,
          submitted: s.submitted,
          late: s.late,
          absent: s.absent,
          pending: s.pending,
        },
      ])
    );

    const roundsWithStats = allRounds.map((round) => {
      const stats = statsMap.get(round.id) || {
        total: 0,
        submitted: 0,
        late: 0,
        absent: 0,
        pending: 0,
      };

      return {
        id: round.id,
        roundNumber: round.roundNumber,
        startDate: round.startDate,
        endDate: round.endDate,
        graceEndDate: round.graceEndDate,
        isCurrent: round.isCurrent,
        stats: {
          ...stats,
          submissionRate: stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0,
        },
      };
    });

    return successResponse({
      rounds: roundsWithStats,
      total: allRounds.length,
    });
  } catch (error) {
    console.error('Admin rounds API error:', error);
    return errorResponse(error);
  }
});

/**
 * POST /api/admin/rounds
 * Create rounds based on start date and total rounds
 * Requirements: 15.1, 15.2
 */
export const POST = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const body = await request.json();
    const { startDate, totalRounds } = body;

    // Validate required fields
    if (!startDate) {
      return Errors.badRequest('시작일이 필요합니다.').toResponse();
    }

    if (!totalRounds || totalRounds < 1 || totalRounds > 52) {
      return Errors.badRequest('총 회차는 1~52 사이여야 합니다.').toResponse();
    }

    const database = db();

    // Check if rounds already exist
    const existingRounds = await database.select().from(rounds);
    if (existingRounds.length > 0) {
      return Errors.conflict('이미 회차가 생성되어 있습니다. 기존 회차를 삭제 후 다시 시도해주세요.').toResponse();
    }

    // Parse start date
    const parsedStartDate = new Date(startDate);
    if (isNaN(parsedStartDate.getTime())) {
      return Errors.badRequest('유효하지 않은 날짜 형식입니다.').toResponse();
    }

    // Helper function to format date as YYYY-MM-DD string
    const formatDateString = (date: Date): string => {
      const isoString = date.toISOString().split('T')[0];
      return isoString || '';
    };

    // Generate rounds
    const roundsToCreate = [];
    const now = new Date();

    for (let i = 1; i <= totalRounds; i++) {
      const dates = calculateRoundDates(parsedStartDate, i);
      
      // Determine if this is the current round
      const roundStart = new Date(dates.startDate);
      const roundGraceEnd = new Date(dates.graceEndDate);
      const isCurrent = now >= roundStart && now <= roundGraceEnd;

      roundsToCreate.push({
        roundNumber: i,
        startDate: formatDateString(dates.startDate),
        endDate: formatDateString(dates.endDate),
        graceEndDate: formatDateString(dates.graceEndDate),
        isCurrent,
      });
    }

    // Insert all rounds
    await database.insert(rounds).values(roundsToCreate);

    // Create attendance records for active members for the current round
    const currentRound = roundsToCreate.find((r) => r.isCurrent);
    if (currentRound) {
      const activeMembers = await database
        .select({ id: members.id })
        .from(members)
        .where(eq(members.status, MemberStatus.ACTIVE));

      const [insertedCurrentRound] = await database
        .select()
        .from(rounds)
        .where(eq(rounds.roundNumber, currentRound.roundNumber))
        .limit(1);

      if (insertedCurrentRound && activeMembers.length > 0) {
        const attendanceRecords = activeMembers.map((member) => ({
          memberId: member.id,
          roundId: insertedCurrentRound.id,
          status: AttendanceStatus.PENDING,
        }));

        await database.insert(attendance).values(attendanceRecords);
      }
    }

    return successResponse(
      {
        created: roundsToCreate.length,
        currentRound: currentRound?.roundNumber || null,
      },
      `${roundsToCreate.length}개의 회차가 생성되었습니다.`
    );
  } catch (error) {
    console.error('Admin create rounds error:', error);
    return errorResponse(error);
  }
});
