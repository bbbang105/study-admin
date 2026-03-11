'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { NoticeBanner } from './notice-banner';
import { PullToRefresh } from './pull-to-refresh';
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
      id="main-content"
      tabIndex={-1}
      className={cn(
        'flex-1 min-w-0 min-h-0 transition-[margin-left] duration-200',
        showSidebar && (collapsed ? 'md:ml-16' : 'md:ml-60'),
        'pb-20 md:pb-0' // bottom nav spacing on mobile
      )}
    >
      <div
        data-ptr-scroll="true"
        className="w-full h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto"
      >
        {children}
      </div>
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
    <div className="h-screen overflow-hidden flex flex-col">
      <a href="#main-content" className="skip-to-content">
        본문으로 바로가기
      </a>
      <Header user={user} isAdmin={isAdmin} onLogout={handleLogout} />
      {!isAdmin && <NoticeBanner />}
      <PullToRefresh>
        <div className="flex flex-1 min-h-0 overflow-hidden">
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
      </PullToRefresh>
      {showSidebar && <BottomNav isAdmin={isAdmin} />}
    </div>
  );
}
