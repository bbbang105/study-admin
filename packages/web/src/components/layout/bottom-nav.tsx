'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  CalendarCheck,
  CalendarRange,
  FileText,
  MessageSquare,
  Newspaper,
  Star,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const userNavItems: NavItem[] = [
  { title: '포스트', href: '/posts', icon: FileText },
  { title: '랭킹', href: '/ranking', icon: Trophy },
  { title: '큐레이션', href: '/curation', icon: Newspaper },
  { title: '게시판', href: '/board', icon: MessageSquare },
  { title: '스터디원', href: '/members', icon: UsersRound },
];

const adminNavItems: NavItem[] = [
  { title: '멤버', href: '/admin/members', icon: Users },
  { title: '회차', href: '/admin/rounds', icon: CalendarRange },
  { title: '출석', href: '/admin/attendance', icon: CalendarCheck },
  { title: '벌금', href: '/admin/fines', icon: Banknote },
  { title: '점수', href: '/admin/scores', icon: Star },
  { title: '큐레이션', href: '/admin/curation', icon: Newspaper },
];

interface BottomNavProps {
  isAdmin?: boolean;
}

export function BottomNav({ isAdmin = false }: BottomNavProps) {
  const pathname = usePathname();
  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <nav
      aria-label="모바일 내비게이션"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm md:hidden"
    >
      <div className="flex h-14 items-center justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} aria-hidden="true" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for iOS home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
