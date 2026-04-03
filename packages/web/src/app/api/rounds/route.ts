import { NextRequest, NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';

const { rounds } = sharedDb;

/**
 * GET /api/rounds
 * Get all rounds with optional filtering
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
    const current = searchParams.get('current');
    const sortOrder = searchParams.get('sort') || 'asc';

    const database = db();

    // If requesting current round only
    if (current === 'true') {
      const [currentRound] = await database
        .select()
        .from(rounds)
        .where(eq(rounds.isCurrent, true))
        .limit(1);

      if (!currentRound) {
        return NextResponse.json({
          success: true,
          data: { round: null },
          message: '현재 진행 중인 회차가 없습니다.',
        });
      }

      const now = new Date();
      const endOfDeadline = new Date(`${currentRound.endDate}T23:59:59.999+09:00`);
      const endOfGrace = new Date(`${currentRound.graceEndDate}T23:59:59.999+09:00`);

      // KST 캘린더 날짜 기준 D-Day 계산 (당일 = D-Day = 0)
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = kstNow.toISOString().split('T')[0]!;
      const todayMidnight = new Date(`${todayStr}T00:00:00+09:00`);
      const endMidnight = new Date(`${currentRound.endDate}T00:00:00+09:00`);
      const daysRemaining = Math.round(
        (endMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 지각: 마감일 다음 날부터 ~ 지각 마감일 23:59:59까지
      const isGracePeriod = now > endOfDeadline && now <= endOfGrace;

      return successResponse({
        round: {
          id: currentRound.id,
          roundNumber: currentRound.roundNumber,
          startDate: currentRound.startDate,
          endDate: currentRound.endDate,
          graceEndDate: currentRound.graceEndDate,
          isCurrent: currentRound.isCurrent,
          daysRemaining: Math.max(0, daysRemaining),
          isGracePeriod,
        },
      });
    }

    // Get all rounds
    const allRounds = await database
      .select()
      .from(rounds)
      .orderBy(sortOrder === 'desc' ? desc(rounds.roundNumber) : asc(rounds.roundNumber));

    return successResponse({
      rounds: allRounds.map((round) => ({
        id: round.id,
        roundNumber: round.roundNumber,
        startDate: round.startDate,
        endDate: round.endDate,
        graceEndDate: round.graceEndDate,
        isCurrent: round.isCurrent,
      })),
      total: allRounds.length,
    });
  } catch (error) {
    console.error('Rounds API error:', error);
    return errorResponse(error);
  }
}
