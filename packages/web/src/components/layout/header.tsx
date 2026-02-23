'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Menu, LogOut, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    imageUrl?: string;
  } | null;
  onMenuClick?: () => void;
  onLogout?: () => void;
}

const PATH_TITLE_MAP: Record<string, string> = {
  '/dashboard': '대시보드',
  '/posts': '글 목록',
  '/ranking': '랭킹',
  '/curation': '큐레이션',
  '/profile': '프로필',
  '/admin': '관리자',
  '/admin/members': '멤버 관리',
  '/admin/attendance': '출석 관리',
  '/admin/fines': '벌금 관리',
  '/admin/settings': '설정',
  '/admin/curation': '큐레이션 소스',
};

function resolvePageTitle(pathname: string): string {
  // Exact match first
  if (PATH_TITLE_MAP[pathname]) {
    return PATH_TITLE_MAP[pathname];
  }
  // Longest prefix match for nested routes (e.g. /admin/members/123)
  const match = Object.keys(PATH_TITLE_MAP)
    .filter((key) => pathname.startsWith(key + '/'))
    .sort((a, b) => b.length - a.length)[0] as string | undefined;
  return match ? PATH_TITLE_MAP[match]! : '';
}

function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder with the same dimensions to prevent layout shift
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground"
        aria-label="테마 전환"
        disabled
      >
        <span className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

export function Header({ user, onMenuClick, onLogout }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = resolvePageTitle(pathname);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full',
        'border-b border-border/60',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'
      )}
    >
      <div className="flex h-14 items-center px-4 lg:px-6">

        {/* Left: hamburger (mobile only) */}
        <div className="flex items-center lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={onMenuClick}
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Left: page title (desktop only) */}
        {pageTitle && (
          <div className="hidden lg:flex items-center">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {pageTitle}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: dark mode toggle + user info + logout */}
        <div className="flex items-center gap-1">

          {/* Dark mode toggle */}
          <DarkModeToggle />

          {user && (
            <>
              {/* Thin divider */}
              <span
                className="hidden lg:block mx-2 h-5 w-px bg-border"
                aria-hidden="true"
              />

              {/* Avatar + name (desktop only) */}
              <div className="hidden lg:flex items-center gap-2.5 px-1">
                <Avatar className="h-8 w-8 ring-2 ring-border ring-offset-1 ring-offset-background">
                  <AvatarImage src={user.imageUrl} alt={user.name} />
                  <AvatarFallback className="bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground leading-none">
                  {user.name}
                </span>
              </div>

              {/* Logout button */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-9 gap-1.5 text-muted-foreground hover:text-foreground',
                  'ml-1'
                )}
                onClick={onLogout}
                aria-label="로그아웃"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline text-sm">로그아웃</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
