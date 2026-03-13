import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isAdminDiscordId } from '@/lib/admin';

const protectedRoutes = [
  '/dashboard',
  '/posts',
  '/curation',
  '/ranking',
  '/profile',
  '/members',
  '/board',
];

const adminRoutes = ['/admin'];

const authRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { user, supabaseResponse } = await updateSession(request);
  const isAuthenticated = !!user;

  // 인증 완료 시 로그인 페이지 → 대시보드 리다이렉트
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return supabaseResponse;
  }

  // 보호된 라우트 — 미인증 시 로그인 리다이렉트
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // 관리자 라우트 — 미인증 시 로그인, 비관리자 시 대시보드 리다이렉트
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const discordIdentity = user?.identities?.find(
      (identity) => identity.provider === 'discord'
    );
    const discordId = discordIdentity?.id;

    if (!discordId || !isAdminDiscordId(discordId)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
  ],
};
