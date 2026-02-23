'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || '로그인에 실패했습니다.');
        return;
      }

      // Redirect to intended page or dashboard
      router.push(redirect);
      router.refresh();
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm border-border shadow-sm">
      <CardHeader className="pb-6 pt-8 px-8 space-y-5">
        {/* BS Logo */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold tracking-tight select-none">
              BS
            </span>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            로그인
          </h1>
          <p className="text-sm text-muted-foreground">
            블로그 스터디에 오신 것을 환영합니다
          </p>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="px-8 space-y-4">
          {error && (
            <div className="px-3 py-2.5 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">
              이메일
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">
              비밀번호
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-9"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-8 pb-8 pt-2">
          <Button
            type="submit"
            className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors"
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            계정이 없으신가요?{' '}
            <Link
              href="/register"
              className="text-primary font-medium hover:underline underline-offset-4 transition-colors"
            >
              회원가입
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

function LoginSkeleton() {
  return (
    <Card className="w-full max-w-sm border-border shadow-sm">
      <CardHeader className="pb-6 pt-8 px-8 space-y-5">
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold tracking-tight select-none">
              BS
            </span>
          </div>
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            로그인
          </h1>
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Suspense fallback={<LoginSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
