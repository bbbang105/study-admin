'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from './header';
import { Sidebar, useSidebarCollapsed } from './sidebar';
import { Footer } from './footer';
import { cn } from '@/lib/utils';

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

// Inner wrapper that reads sidebar collapsed state to apply the correct margin.
function MainContent({
  children,
  showSidebar,
}: {
  children: React.ReactNode;
  showSidebar: boolean;
}) {
  const collapsed = useSidebarCollapsed();

  return (
    <main
      className={cn(
        'flex-1 transition-[margin-left] duration-200',
        showSidebar && (collapsed ? 'md:ml-16' : 'md:ml-60')
      )}
    >
      <div className="container py-6">{children}</div>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen flex flex-col">
      <Header
        user={user}
        onMenuClick={() => setSidebarOpen(true)}
        onLogout={handleLogout}
      />
      <div className="flex flex-1">
        {showSidebar && (
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            isAdmin={isAdmin}
          />
        )}
        <MainContent showSidebar={showSidebar}>{children}</MainContent>
      </div>
      <Footer />
    </div>
  );
}
