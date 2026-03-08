import { createClient } from '@/lib/supabase/server';
import { errorResponse, successResponse } from '@/lib/api-error';

/**
 * POST /api/auth/logout
 * Supabase Auth signOut
 */
export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    return successResponse(null, '로그아웃되었습니다.');
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse(error);
  }
}
