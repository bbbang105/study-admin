'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';

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

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        // Check admin status
        const adminResponse = await fetch('/api/admin/check');
        const adminData = await adminResponse.json();

        if (!adminResponse.ok || !adminData.isAdmin) {
          // Not admin, redirect to dashboard
          router.push('/dashboard');
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
        <div className="text-muted-foreground">권한 확인 중...</div>
      </div>
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
