import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// 인증 불필요 경로
const PUBLIC_PATHS = ['/login', '/auth/callback'];

// 인증 필요 경로 prefix
const PROTECTED_PREFIXES = ['/dashboard', '/profile', '/posts', '/members', '/ranking', '/curation'];

// 관리자 전용 경로 prefix
const ADMIN_PREFIXES = ['/admin'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID().slice(0, 8);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[proxy:${requestId}] ${request.method} ${pathname}`);
  }

  // 세션 갱신 (모든 요청에서 실행)
  const { user, supabaseResponse } = await updateSession(request);

  const isAuthenticated = !!user;
  const discordId = user?.identities?.find((i) => i.provider === 'discord')?.id;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[proxy:${requestId}] user=${isAuthenticated ? user.id.slice(0, 8) : 'none'}, discord=${discordId ?? 'none'}`
    );
  }

  // 공개 경로 → 로그인 상태면 대시보드로
  if (isPublicPath(pathname)) {
    if (isAuthenticated && pathname.startsWith('/login')) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[proxy:${requestId}] 로그인 상태 → /dashboard 리다이렉트`);
      }
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 보호된 경로 → 미인증이면 로그인으로
  if (isProtectedPath(pathname) || isAdminPath(pathname)) {
    if (!isAuthenticated) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[proxy:${requestId}] 미인증 → /login 리다이렉트`);
      }
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  // 관리자 경로 → 관리자 체크 (환경변수 기반)
  if (isAdminPath(pathname)) {
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
    if (!discordId || !adminIds.includes(discordId)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[proxy:${requestId}] 관리자 아님 → /dashboard 리다이렉트`);
      }
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * _next/static, _next/image, favicon, 정적 파일 제외
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
