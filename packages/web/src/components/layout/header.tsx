'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { LayoutDashboard, LogOut, Moon, Shield, Sun, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    imageUrl?: string;
  } | null;
  isAdmin?: boolean;
  onLogout?: () => void;
}

const emptySubscribe = () => () => {};

function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

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
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function Header({ user, isAdmin = false, onLogout }: HeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full',
        'border-b border-border/60',
        'bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60'
      )}
    >
      <div className="flex h-14 items-center px-4 lg:px-6">
        {/* Logo */}
        <Link
          href={isAdmin ? '/admin' : '/dashboard'}
          className="flex items-center gap-2 select-none hover:opacity-80 transition-opacity"
        >
          <span className="text-lg font-black tracking-tight text-foreground">BS</span>
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase hidden sm:inline">
            Blog Study
          </span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: dark mode toggle + user menu */}
        <div className="flex items-center gap-1">
          {/* Dark mode toggle */}
          <DarkModeToggle />

          {user && (
            <div className="relative flex items-center" ref={menuRef}>
              <button
                type="button"
                className="ml-2 flex items-center rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="사용자 메뉴"
              >
                <Avatar className="h-8 w-8 ring-2 ring-border ring-offset-1 ring-offset-background cursor-pointer">
                  <AvatarImage src={user.imageUrl} alt={user.name} />
                  <AvatarFallback className="bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-popover shadow-lg py-1 z-50">
                  {/* Email */}
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>

                  {/* Profile */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push('/profile');
                    }}
                  >
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    프로필
                  </button>

                  {/* Admin / User toggle */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(isAdmin ? '/dashboard' : '/admin');
                    }}
                  >
                    {isAdmin ? (
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    )}
                    {isAdmin ? '사용자' : '관리자'}
                  </button>

                  {/* Logout */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-accent transition-colors"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout?.();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
