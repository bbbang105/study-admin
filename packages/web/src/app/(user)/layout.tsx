'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    // Get user info from cookie or API
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser({
            name: data.email.split('@')[0],
            email: data.email,
            imageUrl: data.profileImageUrl,
          });
        }
      } catch {
        // User not authenticated, middleware will handle redirect
      }
    };
    fetchUser();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      console.error('Logout failed');
    }
  }, [router]);

  return (
    <MainLayout user={user} isAdmin={false} showSidebar={true} onLogout={handleLogout}>
      {children}
    </MainLayout>
  );
}
