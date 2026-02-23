import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { verifyToken } from '@/lib/auth';

const { users, members } = sharedDb;

/**
 * Get admin Discord IDs from environment variable
 * Format: comma-separated list of Discord IDs
 */
export function getAdminDiscordIds(): string[] {
  const adminIds = process.env.ADMIN_DISCORD_IDS || '';
  return adminIds.split(',').map((id) => id.trim()).filter(Boolean);
}

/**
 * Check if a Discord ID is in the admin list
 * Requirement: 16.2
 */
export function isAdminDiscordId(discordId: string): boolean {
  const adminIds = getAdminDiscordIds();
  return adminIds.includes(discordId);
}

/**
 * Admin authentication result
 */
export interface AdminAuthResult {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userId?: string;
  email?: string;
  memberId?: string;
  discordId?: string;
  error?: string;
}

/**
 * Verify admin access for API routes
 * Checks if the authenticated user is linked to a member with admin Discord ID
 * Requirements: 16.2, 16.3
 * 
 * @returns AdminAuthResult with authentication and admin status
 */
export async function verifyAdminAccess(): Promise<AdminAuthResult> {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth-token')?.value;

    if (!authToken) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        error: '인증이 필요합니다.',
      };
    }

    // Verify JWT token
    const payload = verifyToken(authToken);
    if (!payload) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        error: '유효하지 않은 토큰입니다.',
      };
    }

    // Get user from database
    const database = db();
    const [userData] = await database
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!userData) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        error: '사용자를 찾을 수 없습니다.',
      };
    }

    // Check if user is linked to a member
    if (!userData.memberId) {
      return {
        isAuthenticated: true,
        isAdmin: false,
        userId: userData.id,
        email: userData.email,
        error: '스터디 멤버와 연결되지 않았습니다.',
      };
    }

    // Get member info to check Discord ID
    const [memberData] = await database
      .select()
      .from(members)
      .where(eq(members.id, userData.memberId))
      .limit(1);

    if (!memberData) {
      return {
        isAuthenticated: true,
        isAdmin: false,
        userId: userData.id,
        email: userData.email,
        memberId: userData.memberId,
        error: '멤버 정보를 찾을 수 없습니다.',
      };
    }

    // Check if member's Discord ID is in admin list
    const isAdmin = isAdminDiscordId(memberData.discordId);

    return {
      isAuthenticated: true,
      isAdmin,
      userId: userData.id,
      email: userData.email,
      memberId: userData.memberId,
      discordId: memberData.discordId,
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

/**
 * Create a 403 Forbidden response for non-admin users
 * Requirement: 16.3
 */
export function createForbiddenResponse(message?: string): NextResponse {
  return NextResponse.json(
    { message: message || '관리자 권한이 필요합니다.' },
    { status: 403 }
  );
}

/**
 * Create a 401 Unauthorized response
 */
export function createUnauthorizedResponse(message?: string): NextResponse {
  return NextResponse.json(
    { message: message || '인증이 필요합니다.' },
    { status: 401 }
  );
}

/**
 * Higher-order function to wrap API route handlers with admin check
 * Requirements: 16.2, 16.3
 * 
 * Usage:
 * ```typescript
 * export const GET = withAdminAuth(async (request, adminAuth) => {
 *   // Your handler code here
 *   // adminAuth contains user info
 * });
 * ```
 */
export function withAdminAuth(
  handler: (request: NextRequest, adminAuth: AdminAuthResult) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const adminAuth = await verifyAdminAccess();

    // Check authentication
    if (!adminAuth.isAuthenticated) {
      return createUnauthorizedResponse(adminAuth.error);
    }

    // Check admin permission (Requirement: 16.3)
    if (!adminAuth.isAdmin) {
      return createForbiddenResponse(adminAuth.error);
    }

    // Call the actual handler
    return handler(request, adminAuth);
  };
}

/**
 * Check admin status for a specific Discord ID
 * Useful for checking admin status without full authentication flow
 */
export async function checkAdminByDiscordId(discordId: string): Promise<boolean> {
  return isAdminDiscordId(discordId);
}

/**
 * Get admin status for the current user (for client-side use)
 * Returns admin info that can be safely exposed to the client
 */
export async function getAdminStatus(): Promise<{
  isAdmin: boolean;
  discordId?: string;
}> {
  const result = await verifyAdminAccess();
  return {
    isAdmin: result.isAdmin,
    discordId: result.discordId,
  };
}
