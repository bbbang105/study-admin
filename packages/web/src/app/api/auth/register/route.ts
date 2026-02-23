import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';

const { users } = sharedDb;
import {
  isValidEmail,
  isValidPassword,
  hashPassword,
  generateVerificationToken,
  getVerificationExpiry,
} from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: string;
}

/**
 * POST /api/auth/register
 * Register a new user with email and password
 * Requirements: 17.1, 17.2, 17.3
 */
export async function POST(request: NextRequest): Promise<NextResponse<RegisterResponse>> {
  try {
    const body = (await request.json()) as RegisterRequest;
    const { email, password } = body;

    // Validate email format (Requirement 17.1)
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // Validate password strength (Requirement 17.1)
    if (!password || !isValidPassword(password)) {
      return NextResponse.json(
        { success: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const database = db();

    // Check if email already exists
    const existingUser = await database
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { success: false, message: '이미 등록된 이메일입니다.' },
        { status: 409 }
      );
    }

    // Hash password using bcrypt (Requirement 17.2)
    const passwordHash = await hashPassword(password);

    // Generate verification token (Requirement 17.3)
    const verificationToken = generateVerificationToken();
    const verificationExpiry = getVerificationExpiry();

    // Create user record
    const [newUser] = await database
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        emailVerified: false,
        emailVerifyToken: verificationToken,
        emailVerifyExpires: verificationExpiry,
      })
      .returning({ id: users.id });

    // Send verification email (Requirement 17.3)
    const emailResult = await sendVerificationEmail(email, verificationToken);

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      // User is created but email failed - they can request resend later
    }

    return NextResponse.json(
      {
        success: true,
        message: '회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해 주세요.',
        userId: newUser?.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
