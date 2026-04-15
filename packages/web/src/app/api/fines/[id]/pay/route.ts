import { NextRequest, after } from 'next/server';
import { eq } from 'drizzle-orm';
import { db as sharedDb } from '@blog-study/shared';
import { config } from '@blog-study/shared/db';
import { createClient } from '@/lib/supabase/server';
import { getDb } from '@/lib/db';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { sendDiscordChannelMessage } from '@/lib/discord-notify';
import { logNotification } from '@/lib/notification-log';

const { members, fines, rounds, FineStatus } = sharedDb;

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fineId } = await params;
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
      .select({ id: members.id, name: members.name, nickname: members.nickname })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);
    if (!member) return Errors.notFound('멤버를 찾을 수 없습니다.').toResponse();

    const [fine] = await database.select().from(fines).where(eq(fines.id, fineId)).limit(1);
    if (!fine) return Errors.notFound('벌금을 찾을 수 없습니다.').toResponse();
    if (fine.memberId !== member.id)
      return Errors.forbidden('본인의 벌금만 처리할 수 있습니다.').toResponse();
    if (fine.status !== FineStatus.UNPAID)
      return Errors.badRequest('이미 처리된 벌금입니다.').toResponse();

    const [updated] = await database
      .update(fines)
      .set({
        status: FineStatus.PAID,
        paidAt: new Date(),
        pendingConfirmation: false,
      })
      .where(eq(fines.id, fineId))
      .returning();

    after(async () => {
      try {
        const [round] = await database
          .select({ roundNumber: rounds.roundNumber })
          .from(rounds)
          .where(eq(rounds.id, fine.roundId))
          .limit(1);

        const displayName = member.name || member.nickname;
        const reason = fine.type === 'late' ? '지각' : '결석';
        const roundText = round ? `${round.roundNumber}회차` : '';

        const [channelRow] = await database
          .select({ value: config.value })
          .from(config)
          .where(eq(config.key, 'admin_notification_channel_id'))
          .limit(1);

        const adminChannelId = channelRow?.value;
        if (adminChannelId) {
          const discordResult = await sendDiscordChannelMessage({
            channelId: adminChannelId,
            content: `💰 **${displayName}**님이 ${roundText} ${reason} 벌금 ${fine.amount.toLocaleString()}원 납부를 완료했습니다. (웹)`,
          });
          await logNotification({
            source: 'web',
            type: 'fine_payment',
            channelId: adminChannelId,
            summary: `${displayName}님 ${roundText} ${reason} 벌금 납부 확인 (웹)`,
            messageId: discordResult.messageId,
            status: discordResult.success ? 'sent' : 'failed',
            errorMessage: discordResult.error,
          });
        }
      } catch (err) {
        console.error('[fines/pay] Admin notification failed:', err);
      }
    });

    return successResponse({ fine: updated }, '납부가 확인되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
