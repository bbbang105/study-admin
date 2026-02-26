import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // 쿠키 상태 로깅
  if (process.env.NODE_ENV === 'development') {
    const authCookies = request.cookies.getAll().filter((c) => c.name.startsWith('sb-'));
    console.log(
      `[updateSession] 요청 쿠키: ${authCookies.length > 0 ? authCookies.map((c) => `${c.name}(${c.value.length}chars)`).join(', ') : '없음'}`
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[updateSession] 쿠키 갱신: ${cookiesToSet.map((c) => c.name).join(', ')}`
            );
          }
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (process.env.NODE_ENV === 'development') {
    if (error) {
      console.log(`[updateSession] getUser 에러: ${error.message} (code: ${error.code})`);
    } else if (user) {
      console.log(`[updateSession] 세션 유효: user=${user.id.slice(0, 8)}...`);
    } else {
      console.log(`[updateSession] 세션 없음 (미인증)`);
    }
  }

  return { user, supabaseResponse };
}
