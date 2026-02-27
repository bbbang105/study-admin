'use client';

import { useRouter } from 'next/navigation';
import { Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PendingApprovalPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30">
          <Clock className="h-10 w-10 text-sky-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            관리자 승인 대기 중
          </h1>
          <p className="text-muted-foreground">
            온보딩이 완료되었습니다.<br />
            관리자가 가입을 확인하면 서비스를 이용하실 수 있습니다.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            궁금한 점이 있으시면 Discord 채널에서 관리자에게 문의해주세요.
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
