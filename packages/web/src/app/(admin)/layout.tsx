'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { MainLayout } from '@/components/layout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UserInfo {
  name: string;
  email: string;
  imageUrl?: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        // Check admin status
        const adminResponse = await fetch('/api/admin/check');
        const adminData = await adminResponse.json();

        if (!adminResponse.ok || !adminData.isAdmin) {
          setShowAccessDenied(true);
          setLoading(false);
          return;
        }

        setIsAdmin(true);

        // Get user info
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser({
            name: userData.name || userData.discordUsername || userData.email?.split('@')[0] || '',
            email: userData.email || '',
            imageUrl: userData.profileImageUrl || userData.avatarUrl,
          });
        }
      } catch {
        // Error checking admin, redirect to login
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      console.error('Logout failed');
    }
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-4xl px-6">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-muted animate-pulse rounded-lg mt-4" />
        </div>
      </div>
    );
  }

  if (showAccessDenied) {
    return (
      <AlertDialog open>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-base text-center">
              관리자만 접근할 수 있습니다
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-center text-muted-foreground">
              이 페이지는 관리자 전용입니다. 대시보드로 이동합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction
              onClick={() => router.push('/dashboard')}
              className="h-9 text-sm"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <MainLayout user={user} isAdmin={true} showSidebar={true} onLogout={handleLogout}>
      {children}
    </MainLayout>
  );
}
