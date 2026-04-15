import { eq, sql } from 'drizzle-orm';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { getDb } from '@/lib/db';
import { errorResponse, Errors, successResponse, withCache } from '@/lib/api-error';

const { members, fines, rounds, FineStatus } = sharedDb;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return Errors.unauthorized().toResponse();

    const discordId = user.identities?.find((i) => i.provider === 'discord')?.id;
    if (!discordId) return Errors.unauthorized().toResponse();

    const database = getDb();
    const [member] = await database
      .select({ id: members.id })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!member) return Errors.notFound('멤버를 찾을 수 없습니다.').toResponse();

    const fineList = await database
      .select({
        id: fines.id,
        roundNumber: rounds.roundNumber,
        type: fines.type,
        amount: fines.amount,
        status: fines.status,
        createdAt: fines.createdAt,
        paidAt: fines.paidAt,
      })
      .from(fines)
      .innerJoin(rounds, eq(fines.roundId, rounds.id))
      .where(eq(fines.memberId, member.id))
      .orderBy(
        sql`CASE WHEN ${fines.status} = ${FineStatus.UNPAID} THEN 0 ELSE 1 END`,
        sql`${fines.createdAt} DESC`
      );

    const summary = {
      unpaid: fineList
        .filter((f) => f.status === FineStatus.UNPAID)
        .reduce((sum, f) => sum + f.amount, 0),
      paid: fineList
        .filter((f) => f.status === FineStatus.PAID)
        .reduce((sum, f) => sum + f.amount, 0),
      total: fineList.reduce((sum, f) => sum + f.amount, 0),
    };

    return withCache(successResponse({ fines: fineList, summary }), 30);
  } catch (error) {
    return errorResponse(error);
  }
}
