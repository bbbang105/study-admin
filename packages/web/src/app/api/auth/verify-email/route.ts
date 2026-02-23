import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';

const { users } = sharedDb;
import { generateVerificationToken, getVerificationExpiry } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
}

export interface ResendVerificationRequest {
  email: string;
}

/**
 * GET /api/auth/verify-email?token=xxx
 * Verify email with token
 * Requirements: 17.4, 17.5
 */
export async function GET(request: NextRequest): Promise<NextResponse<VerifyEmailResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    const database = db();

    // Find user with valid token (Requirement 17.4)
    const [user] = await database
      .select()
      .from(users)
      .where(
        and(
          eq(users.emailVerifyToken, token),
          gt(users.emailVerifyExpires, new Date())
        )
      )
      .limit(1);

    // Token expired or invalid (Requirement 17.5)
    if (!user) {
      return NextResponse.json(
        { success: false, message: '유효하지 않거나 만료된 인증 토큰입니다.' },
        { status: 400 }
      );
    }

    // Already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { success: true, message: '이미 인증된 이메일입니다.' },
        { status: 200 }
      );
    }

    // Mark email as verified (Requirement 17.4)
    await database
      .update(users)
      .set({
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json(
      { success: true, message: '이메일 인증이 완료되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/verify-email
 * Resend verification email (Requirement 17.5)
 */
export async function POST(request: NextRequest): Promise<NextResponse<VerifyEmailResponse>> {
  try {
    const body = (await request.json()) as ResendVerificationRequest;
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, message: '이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    const database = db();

    // Find user by email
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      // Don't reveal if email exists
      return NextResponse.json(
        { success: true, message: '인증 이메일이 발송되었습니다.' },
        { status: 200 }
      );
    }

    // Already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { success: false, message: '이미 인증된 이메일입니다.' },
        { status: 400 }
      );
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationExpiry = getVerificationExpiry();

    // Update user with new token
    await database
      .update(users)
      .set({
        emailVerifyToken: verificationToken,
        emailVerifyExpires: verificationExpiry,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    return NextResponse.json(
      { success: true, message: '인증 이메일이 발송되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
