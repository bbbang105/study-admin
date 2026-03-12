'use client';

import { useRouter } from 'next/navigation';
import { LogOut, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InactivePage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <ShieldX className="h-10 w-10 text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">계정이 비활성화되었습니다</h1>
          <p className="text-muted-foreground">
            관리자에 의해 계정이 비활성화되었습니다.
            <br />
            자세한 사항은 관리자에게 문의해주세요.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            Discord 채널에서 관리자에게 문의하실 수 있습니다.
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
