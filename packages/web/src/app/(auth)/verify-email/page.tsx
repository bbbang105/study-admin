'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('인증 토큰이 없습니다.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || '이메일 인증이 완료되었습니다.');
        } else {
          setStatus('error');
          setMessage(data.message || '이메일 인증에 실패했습니다.');
        }
      } catch {
        setStatus('error');
        setMessage('서버 오류가 발생했습니다.');
      }
    };

    verifyEmail();
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">이메일 인증 중...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {status === 'success' ? '인증 완료' : '인증 실패'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 text-center">
            <div className="text-6xl mb-4">
              {status === 'success' ? '✅' : '❌'}
            </div>
            <p className={status === 'success' ? 'text-success' : 'text-destructive'}>
              {message}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          {status === 'success' ? (
            <Button className="w-full" onClick={() => router.push('/login')}>
              로그인하기
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/login')}
              >
                로그인 페이지로 이동
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                인증 이메일을 다시 받으시려면{' '}
                <Link href="/register" className="text-primary hover:underline">
                  회원가입
                </Link>
                을 다시 시도해 주세요.
              </p>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">이메일 인증 중...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
