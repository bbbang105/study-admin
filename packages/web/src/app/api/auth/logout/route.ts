import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/logout
 * Supabase Auth signOut
 */
export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    return NextResponse.json(
      { success: true, message: '로그아웃되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
