import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Get admin Discord IDs from environment variable
 */
export function getAdminDiscordIds(): string[] {
  const adminIds = process.env.ADMIN_DISCORD_IDS || '';
  return adminIds.split(',').map((id) => id.trim()).filter(Boolean);
}

/**
 * Check if a Discord ID is in the admin list
 */
export function isAdminDiscordId(discordId: string): boolean {
  const adminIds = getAdminDiscordIds();
  return adminIds.includes(discordId);
}

export interface AdminAuthResult {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userId?: string;
  email?: string;
  discordId?: string;
  error?: string;
}

/**
 * Supabase Auth → Discord ID → admin 체크
 */
export async function verifyAdminAccess(): Promise<AdminAuthResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        error: '인증이 필요합니다.',
      };
    }

    const discordIdentity = user.identities?.find(
      (identity) => identity.provider === 'discord'
    );
    const discordId = discordIdentity?.id as string | undefined;

    if (!discordId) {
      return {
        isAuthenticated: true,
        isAdmin: false,
        userId: user.id,
        email: user.email,
        error: 'Discord 계정 정보를 찾을 수 없습니다.',
      };
    }

    const isAdmin = isAdminDiscordId(discordId);

    return {
      isAuthenticated: true,
      isAdmin,
      userId: user.id,
      email: user.email,
      discordId,
      error: isAdmin ? undefined : '관리자 권한이 없습니다.',
    };
  } catch (error) {
    console.error('Admin verification error:', error);
    return {
      isAuthenticated: false,
      isAdmin: false,
      error: '서버 오류가 발생했습니다.',
    };
  }
}

export function createForbiddenResponse(message?: string): NextResponse {
  return NextResponse.json(
    { message: message || '관리자 권한이 필요합니다.' },
    { status: 403 }
  );
}

export function createUnauthorizedResponse(message?: string): NextResponse {
  return NextResponse.json(
    { message: message || '인증이 필요합니다.' },
    { status: 401 }
  );
}

/**
 * 관리자 인증 래퍼
 */
export function withAdminAuth(
  handler: (request: NextRequest, adminAuth: AdminAuthResult) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const adminAuth = await verifyAdminAccess();

    if (!adminAuth.isAuthenticated) {
      return createUnauthorizedResponse(adminAuth.error);
    }

    if (!adminAuth.isAdmin) {
      return createForbiddenResponse(adminAuth.error);
    }

    return handler(request, adminAuth);
  };
}
