import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';

const { members, MemberStatus } = sharedDb;

/**
 * POST /api/profile/withdraw
 * Supabase Auth → Discord ID → members status를 withdrawn으로 변경 (soft delete)
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const discordIdentity = user.identities?.find((identity) => identity.provider === 'discord');
    const discordId = discordIdentity?.id as string | undefined;
    if (!discordId) {
      return NextResponse.json(
        { message: '스터디원 계정이 연결되어 있지 않습니다.' },
        { status: 400 }
      );
    }

    const database = db();
    const [memberData] = await database
      .select()
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!memberData) {
      return NextResponse.json({ message: '스터디원 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (memberData.status === MemberStatus.WITHDRAWN) {
      return NextResponse.json({ message: '이미 탈퇴한 계정입니다.' }, { status: 400 });
    }

    await database
      .update(members)
      .set({
        status: MemberStatus.WITHDRAWN,
        updatedAt: new Date(),
      })
      .where(eq(members.id, memberData.id));

    return NextResponse.json({
      message: '탈퇴가 완료되었습니다.',
    });
  } catch (error) {
    console.error('Withdraw API error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
