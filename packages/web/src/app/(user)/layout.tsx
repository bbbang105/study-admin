'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MainLayout } from '@/components/layout';

interface UserInfo {
  name: string;
  email: string;
  imageUrl?: string;
}

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [checkedPathname, setCheckedPathname] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();

          // 온보딩 미완료 시 리다이렉트 (온보딩 페이지 자체는 예외)
          if (!data.onboardingCompleted && pathname !== '/profile/onboarding') {
            router.push('/profile/onboarding');
            return;
          }

          // 상태별 차단 페이지 리다이렉트 (차단 페이지 자체는 예외)
          const blockedPages = ['/pending', '/inactive'];
          if (!blockedPages.includes(pathname)) {
            if (data.status === 'pending_approval') {
              router.push('/pending');
              return;
            }
            if (data.status === 'inactive') {
              router.push('/inactive');
              return;
            }
          }

          setUser({
            name: data.name || data.discordUsername || data.email?.split('@')[0] || '',
            email: data.email || '',
            imageUrl: data.profileImageUrl || data.avatarUrl,
          });
        }
        setCheckedPathname(pathname);
      } catch {
        // User not authenticated, middleware will handle redirect
        setCheckedPathname(pathname);
      }
    };
    fetchUser();
  }, [pathname, router]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      console.error('Logout failed');
    }
  }, [router]);

  // 체크 완료 전 스켈레톤 표시 (pathname 변경 시 자동 리셋, 온보딩 페이지는 바로 표시)
  if (checkedPathname !== pathname && pathname !== '/profile/onboarding') {
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

  return (
    <MainLayout user={user} isAdmin={false} showSidebar={true} onLogout={handleLogout}>
      {children}
    </MainLayout>
  );
}
