'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'study-sidebar-collapsed';

interface MainLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    imageUrl?: string;
  } | null;
  isAdmin?: boolean;
  showSidebar?: boolean;
  onLogout?: () => void;
}

// Inner wrapper that applies the correct left margin based on sidebar state.
function MainContent({
  children,
  showSidebar,
  collapsed,
}: {
  children: React.ReactNode;
  showSidebar: boolean;
  collapsed: boolean;
}) {
  return (
    <main
      className={cn(
        'flex-1 min-w-0 transition-[margin-left] duration-200',
        showSidebar && (collapsed ? 'md:ml-16' : 'md:ml-60'),
        'pb-20 md:pb-0' // bottom nav spacing on mobile
      )}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">{children}</div>
    </main>
  );
}

export function MainLayout({
  children,
  user,
  isAdmin = false,
  showSidebar = true,
  onLogout,
}: MainLayoutProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const handleToggleCollapsed = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  };

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      } catch {
        console.error('Logout failed');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Header user={user} onLogout={handleLogout} />
      <div className="flex flex-1">
        {showSidebar && (
          <Sidebar
            isAdmin={isAdmin}
            collapsed={collapsed}
            onToggleCollapsed={handleToggleCollapsed}
          />
        )}
        <MainContent showSidebar={showSidebar} collapsed={collapsed}>
          {children}
        </MainContent>
      </div>
      {showSidebar && <BottomNav />}
    </div>
  );
}
