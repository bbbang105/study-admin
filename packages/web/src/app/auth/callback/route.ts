import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';

const { members } = sharedDb;

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

  console.log(`[auth/callback] code=${code ? '있음' : '없음'}, next=${next}`);

  if (!code) {
    console.log('[auth/callback] code 없음 → /login?error=auth 리다이렉트');
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(`[auth/callback] exchangeCodeForSession 실패: ${error.message} (status: ${error.status})`);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  console.log(
    `[auth/callback] 세션 교환 성공: user=${sessionData.user.id.slice(0, 8)}..., expires_at=${sessionData.session.expires_at}`
  );

  // 온보딩 완료 여부 체크
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const discordIdentity = user?.identities?.find(
      (identity) => identity.provider === 'discord'
    );
    const discordId = discordIdentity?.id;

    console.log(`[auth/callback] discord_id=${discordId ?? '없음'}`);

    if (discordId) {
      const database = db();
      const [memberData] = await database
        .select({ onboardingCompleted: members.onboardingCompleted })
        .from(members)
        .where(eq(members.discordId, discordId))
        .limit(1);

      console.log(
        `[auth/callback] 멤버 조회: ${memberData ? `onboarding=${memberData.onboardingCompleted}` : '레코드 없음'}`
      );

      // 멤버 레코드가 없거나 온보딩 미완료 → 온보딩으로
      if (!memberData || !memberData.onboardingCompleted) {
        console.log('[auth/callback] → /profile/onboarding 리다이렉트');
        return NextResponse.redirect(`${origin}/profile/onboarding`);
      }
    } else {
      // Discord ID가 없는 경우 (일반적이지 않지만) → 온보딩으로
      console.log('[auth/callback] Discord ID 없음 → /profile/onboarding 리다이렉트');
      return NextResponse.redirect(`${origin}/profile/onboarding`);
    }
  } catch (e) {
    console.error('[auth/callback] 온보딩 체크 에러:', e);
    // DB 오류 시 안전하게 대시보드로 (layout에서 2차 체크)
  }

  console.log(`[auth/callback] → ${next} 리다이렉트`);
  return NextResponse.redirect(`${origin}${next}`);
}
