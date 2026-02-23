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
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 온보딩 완료 여부 체크
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const discordIdentity = user?.identities?.find(
          (identity) => identity.provider === 'discord'
        );
        const discordId = discordIdentity?.id;

        if (discordId) {
          const database = db();
          const [memberData] = await database
            .select({ onboardingCompleted: members.onboardingCompleted })
            .from(members)
            .where(eq(members.discordId, discordId))
            .limit(1);

          // 멤버 레코드가 없거나 온보딩 미완료 → 온보딩으로
          if (!memberData || !memberData.onboardingCompleted) {
            return NextResponse.redirect(`${origin}/profile/onboarding`);
          }
        } else {
          // Discord ID가 없는 경우 (일반적이지 않지만) → 온보딩으로
          return NextResponse.redirect(`${origin}/profile/onboarding`);
        }
      } catch (e) {
        console.error('Onboarding check error in callback:', e);
        // DB 오류 시 안전하게 대시보드로 (layout에서 2차 체크)
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
