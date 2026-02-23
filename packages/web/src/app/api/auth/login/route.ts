import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';

const { users, sessions } = sharedDb;
import {
  isValidEmail,
  comparePassword,
  generateToken,
  getSessionExpiry,
} from '@/lib/auth';
import { randomUUID } from 'crypto';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
}

/**
 * POST /api/auth/login
 * Login with email and password
 * Requirements: 17.6, 17.7
 */
export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    const body = (await request.json()) as LoginRequest;
    const { email, password } = body;

    // Validate input
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, message: '비밀번호를 입력해 주세요.' },
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
      return NextResponse.json(
        { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // Verify password (Requirement 17.7)
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // Check email verification (Requirement 17.6)
    if (!user.emailVerified) {
      return NextResponse.json(
        { success: false, message: '이메일 인증이 필요합니다. 이메일을 확인해 주세요.' },
        { status: 403 }
      );
    }

    // Generate JWT token (Requirement 17.7)
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Create session record
    const sessionToken = randomUUID();
    const expiresAt = getSessionExpiry();

    await database.insert(sessions).values({
      userId: user.id,
      token: sessionToken,
      expiresAt,
    });

    // Create response with httpOnly cookie
    const response = NextResponse.json(
      {
        success: true,
        message: '로그인되었습니다.',
        token,
      },
      { status: 200 }
    );

    // Set JWT token as httpOnly cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Set session token as httpOnly cookie
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
