import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';

const { members } = sharedDb;

const isDev = process.env.NODE_ENV === 'development';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/dashboard';
  let next = '/dashboard';
  try {
    const redirectUrl = new URL(rawNext, origin);
    if (redirectUrl.origin === origin) {
      next = redirectUrl.pathname + redirectUrl.search;
    }
  } catch {
    // invalid URL, use default
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    Sentry.setContext('auth', { hasCode: !!code });
    Sentry.captureException(error, { extra: { message: error.message } });
    if (isDev) console.error(`[auth/callback] exchangeCodeForSession 실패: ${error.message}`);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (isDev) {
    console.log(`[auth/callback] 세션 교환 성공: user=${sessionData.user.id.slice(0, 8)}...`);
  }

  // 온보딩 완료 여부 체크
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const discordId = user?.identities?.find((identity) => identity.provider === 'discord')?.id;

    if (discordId) {
      const database = db();
      const [memberData] = await database
        .select({
          onboardingCompleted: members.onboardingCompleted,
          status: members.status,
        })
        .from(members)
        .where(eq(members.discordId, discordId))
        .limit(1);

      // 멤버 레코드가 없거나 온보딩 미완료 → 온보딩으로
      if (!memberData || !memberData.onboardingCompleted) {
        return NextResponse.redirect(`${origin}/profile/onboarding`);
      }

      // 상태별 리다이렉트
      if (memberData.status === 'pending_approval') {
        return NextResponse.redirect(`${origin}/pending`);
      }
      if (memberData.status === 'inactive') {
        return NextResponse.redirect(`${origin}/inactive`);
      }
    } else {
      // Discord ID가 없는 경우 → 온보딩으로
      return NextResponse.redirect(`${origin}/profile/onboarding`);
    }
  } catch (e) {
    Sentry.captureException(e);
    console.error('[auth/callback] 온보딩 체크 에러:', e);
    // DB 오류 시 안전하게 대시보드로 (layout에서 2차 체크)
  }

  return NextResponse.redirect(`${origin}${next}`);
}
