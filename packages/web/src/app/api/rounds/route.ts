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
      const endDate = new Date(currentRound.endDate);
      const graceEndDate = new Date(currentRound.graceEndDate);

      // Calculate days remaining
      const timeDiff = endDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      // Check if in grace period
      const isGracePeriod = now > endDate && now <= graceEndDate;

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
