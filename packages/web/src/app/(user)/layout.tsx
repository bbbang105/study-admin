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
  const [onboardingChecked, setOnboardingChecked] = useState(false);

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

          setUser({
            name: data.name || data.discordUsername || data.email?.split('@')[0] || '',
            email: data.email || '',
            imageUrl: data.profileImageUrl || data.avatarUrl,
          });
        }
      } catch {
        // User not authenticated, middleware will handle redirect
      } finally {
        setOnboardingChecked(true);
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

  // 온보딩 체크 중에는 로딩 표시 (무한루프 방지를 위해 온보딩 페이지는 바로 표시)
  if (!onboardingChecked && pathname !== '/profile/onboarding') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <MainLayout user={user} isAdmin={false} showSidebar={true} onLogout={handleLogout}>
      {children}
    </MainLayout>
  );
}
