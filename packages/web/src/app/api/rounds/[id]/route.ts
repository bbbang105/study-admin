import { NextRequest } from 'next/server';
import { eq, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { Errors, successResponse, errorResponse } from '@/lib/api-error';

const { rounds, attendance, posts, AttendanceStatus } = sharedDb;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/rounds/[id]
 * Get a single round with statistics
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    if (!id) {
      return Errors.badRequest('회차 ID가 필요합니다.').toResponse();
    }

    const database = db();

    // Get round by ID (can be numeric ID or round number)
    let roundData;
    
    // Try to parse as number for round number lookup
    const roundNumber = parseInt(id, 10);
    if (!isNaN(roundNumber)) {
      [roundData] = await database
        .select()
        .from(rounds)
        .where(eq(rounds.roundNumber, roundNumber))
        .limit(1);
    }

    // If not found by round number, try by ID
    if (!roundData) {
      [roundData] = await database
        .select()
        .from(rounds)
        .where(eq(rounds.id, parseInt(id, 10)))
        .limit(1);
    }

    if (!roundData) {
      return Errors.notFound('회차를 찾을 수 없습니다.').toResponse();
    }

    // Get attendance statistics for this round
    const attendanceStats = await database
      .select({
        status: attendance.status,
        count: count(),
      })
      .from(attendance)
      .where(eq(attendance.roundId, roundData.id))
      .groupBy(attendance.status);

    const statsMap = new Map(attendanceStats.map((s) => [s.status, s.count]));
    const total = attendanceStats.reduce((sum, s) => sum + s.count, 0);
    const submitted = statsMap.get(AttendanceStatus.SUBMITTED) || 0;
    const late = statsMap.get(AttendanceStatus.LATE) || 0;
    const absent = statsMap.get(AttendanceStatus.ABSENT) || 0;
    const pending = statsMap.get(AttendanceStatus.PENDING) || 0;

    // Get post count for this round
    const [postCount] = await database
      .select({ count: count() })
      .from(posts)
      .where(eq(posts.roundId, roundData.id));

    // Calculate time-related info
    const now = new Date();
    const endDate = new Date(roundData.endDate);
    const graceEndDate = new Date(roundData.graceEndDate);
    const startDate = new Date(roundData.startDate);
    
    const timeDiff = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    const isGracePeriod = now > endDate && now <= graceEndDate;
    const isCompleted = now > graceEndDate;
    const isUpcoming = now < startDate;

    return successResponse({
      round: {
        id: roundData.id,
        roundNumber: roundData.roundNumber,
        startDate: roundData.startDate,
        endDate: roundData.endDate,
        graceEndDate: roundData.graceEndDate,
        isCurrent: roundData.isCurrent,
        daysRemaining: Math.max(0, daysRemaining),
        isGracePeriod,
        isCompleted,
        isUpcoming,
      },
      stats: {
        total,
        submitted,
        late,
        absent,
        pending,
        submissionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
        lateRate: total > 0 ? Math.round((late / total) * 100) : 0,
        absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
        postCount: postCount?.count ?? 0,
      },
    });
  } catch (error) {
    console.error('Round API error:', error);
    return errorResponse(error);
  }
}
