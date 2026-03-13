import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/admin';

/**
 * GET /api/admin/check
 * Check if the current user has admin privileges
 * Requirements: 16.2, 16.3
 */
export async function GET() {
  try {
    const adminAuth = await verifyAdminAccess();

    // Return 401 if not authenticated
    if (!adminAuth.isAuthenticated) {
      return NextResponse.json(
        { 
          isAdmin: false,
          message: adminAuth.error || '인증이 필요합니다.',
        },
        { status: 401 }
      );
    }

    // Return admin status (Requirement: 16.2)
    // Note: We return 200 even for non-admins, just with isAdmin: false
    // The 403 is returned when trying to access admin-only resources
    return NextResponse.json({
      isAdmin: adminAuth.isAdmin,
    });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json(
      { 
        isAdmin: false,
        message: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
