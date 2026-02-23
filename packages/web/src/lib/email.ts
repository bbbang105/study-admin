import { Resend } from 'resend';

// Lazy initialization to avoid build-time errors when API key is not set
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@example.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<SendEmailResult> {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;

  try {
    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: '블로그 스터디 - 이메일 인증',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">이메일 인증</h1>
          <p>블로그 스터디에 가입해 주셔서 감사합니다!</p>
          <p>아래 버튼을 클릭하여 이메일 인증을 완료해 주세요.</p>
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            이메일 인증하기
          </a>
          <p style="color: #666; font-size: 14px;">
            버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣기 해주세요:
          </p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">
            ${verificationUrl}
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            이 링크는 24시간 동안 유효합니다.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send verification email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending verification email:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * Send password reset email (for future use)
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<SendEmailResult> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  try {
    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: '블로그 스터디 - 비밀번호 재설정',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">비밀번호 재설정</h1>
          <p>비밀번호 재설정을 요청하셨습니다.</p>
          <p>아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            비밀번호 재설정
          </a>
          <p style="color: #666; font-size: 14px;">
            버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣기 해주세요:
          </p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">
            ${resetUrl}
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            이 링크는 1시간 동안 유효합니다. 비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시해 주세요.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending password reset email:', err);
    return { success: false, error: 'Failed to send email' };
  }
}
