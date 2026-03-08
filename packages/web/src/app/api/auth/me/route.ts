import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors } from '@/lib/api-error';

const { members } = sharedDb;

/**
 * GET /api/auth/me
 * Supabase Auth → Discord ID → members 테이블 조회
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return Errors.unauthorized().toResponse();
    }

    const discordIdentity = user.identities?.find((identity) => identity.provider === 'discord');
    const discordId = discordIdentity?.id as string | undefined;

    if (!discordId) {
      return NextResponse.json({
        id: user.id,
        email: user.email,
        discordUsername: user.user_metadata?.full_name,
        avatarUrl: user.user_metadata?.avatar_url,
        hasMemberRecord: false,
        onboardingCompleted: false,
      });
    }

    const database = db();
    const [memberData] = await database
      .select()
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      discordUsername: user.user_metadata?.full_name,
      discordName: user.user_metadata?.name,
      avatarUrl: user.user_metadata?.avatar_url,
      memberId: memberData?.id ?? null,
      profileImageUrl: memberData?.profileImageUrl ?? user.user_metadata?.avatar_url,
      name: memberData?.name ?? null,
      nickname: memberData?.nickname ?? user.user_metadata?.full_name,
      discordId,
      hasMemberRecord: !!memberData,
      onboardingCompleted: memberData?.onboardingCompleted ?? false,
      status: memberData?.status ?? null,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse(error);
  }
}
