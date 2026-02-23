import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';

const { members, rounds, fines, FineStatus } = sharedDb;

/**
 * GET /api/admin/fines
 * Get all fines with member and round information
 * Requirement: 16.7
 */
export const GET = withAdminAuth(async (_request, _adminAuth) => {
  try {
    const database = db();

    // Get all fines with member and round info
    const allFines = await database
      .select({
        id: fines.id,
        memberId: fines.memberId,
        roundId: fines.roundId,
        type: fines.type,
        amount: fines.amount,
        status: fines.status,
        createdAt: fines.createdAt,
        paidAt: fines.paidAt,
        memberName: members.name,
        memberDiscordUsername: members.discordUsername,
        memberPart: members.part,
        roundNumber: rounds.roundNumber,
      })
      .from(fines)
      .leftJoin(members, eq(fines.memberId, members.id))
      .leftJoin(rounds, eq(fines.roundId, rounds.id))
      .orderBy(desc(fines.createdAt));

    // Calculate summary statistics
    const unpaidFines = allFines.filter((f) => f.status === FineStatus.UNPAID);
    const paidFines = allFines.filter((f) => f.status === FineStatus.PAID);
    const waivedFines = allFines.filter((f) => f.status === FineStatus.WAIVED);

    const summary = {
      total: {
        count: allFines.length,
        amount: allFines.reduce((sum, f) => sum + f.amount, 0),
      },
      unpaid: {
        count: unpaidFines.length,
        amount: unpaidFines.reduce((sum, f) => sum + f.amount, 0),
      },
      paid: {
        count: paidFines.length,
        amount: paidFines.reduce((sum, f) => sum + f.amount, 0),
      },
      waived: {
        count: waivedFines.length,
        amount: waivedFines.reduce((sum, f) => sum + f.amount, 0),
      },
    };

    // Group by member for summary view
    const byMember = new Map<string, {
      memberId: string;
      memberName: string;
      memberDiscordUsername: string;
      memberPart: string;
      unpaidCount: number;
      unpaidAmount: number;
      totalCount: number;
      totalAmount: number;
    }>();

    for (const fine of allFines) {
      const existing = byMember.get(fine.memberId);
      if (existing) {
        existing.totalCount++;
        existing.totalAmount += fine.amount;
        if (fine.status === FineStatus.UNPAID) {
          existing.unpaidCount++;
          existing.unpaidAmount += fine.amount;
        }
      } else {
        byMember.set(fine.memberId, {
          memberId: fine.memberId,
          memberName: fine.memberName || '',
          memberDiscordUsername: fine.memberDiscordUsername || '',
          memberPart: fine.memberPart || '',
          unpaidCount: fine.status === FineStatus.UNPAID ? 1 : 0,
          unpaidAmount: fine.status === FineStatus.UNPAID ? fine.amount : 0,
          totalCount: 1,
          totalAmount: fine.amount,
        });
      }
    }

    return NextResponse.json({
      fines: allFines.map((f) => ({
        id: f.id,
        memberId: f.memberId,
        roundId: f.roundId,
        type: f.type,
        amount: f.amount,
        status: f.status,
        createdAt: f.createdAt?.toISOString(),
        paidAt: f.paidAt?.toISOString(),
        memberName: f.memberName,
        memberDiscordUsername: f.memberDiscordUsername,
        memberPart: f.memberPart,
        roundNumber: f.roundNumber,
      })),
      summary,
      byMember: Array.from(byMember.values()).sort((a, b) => b.unpaidAmount - a.unpaidAmount),
    });
  } catch (error) {
    console.error('Admin fines API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
