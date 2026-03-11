'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  CalendarCheck,
  CalendarRange,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Star,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  isAdmin?: boolean;
  collapsed: boolean;
  onToggleCollapsed: (value: boolean) => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// ─── Navigation data ──────────────────────────────────────────────────────────

const userNavItems: NavItem[] = [
  { title: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { title: '포스트', href: '/posts', icon: FileText },
  { title: '랭킹', href: '/ranking', icon: Trophy },
  { title: '큐레이션', href: '/curation', icon: Newspaper },
  { title: '게시판', href: '/board', icon: MessageSquare },
  { title: '스터디원 목록', href: '/members', icon: UsersRound },
];

const adminNavItems: NavItem[] = [
  { title: '관리자 홈', href: '/admin', icon: LayoutDashboard },
  { title: '멤버 관리', href: '/admin/members', icon: Users },
  { title: '회차 관리', href: '/admin/rounds', icon: CalendarRange },
  { title: '출석 관리', href: '/admin/attendance', icon: CalendarCheck },
  { title: '벌금 관리', href: '/admin/fines', icon: Banknote },
  { title: '점수 관리', href: '/admin/scores', icon: Star },
  { title: '큐레이션 소스', href: '/admin/curation', icon: Newspaper },
  { title: '설정', href: '/admin/settings', icon: Settings },
];

// ─── NavLink sub-component ────────────────────────────────────────────────────

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}

function NavLink({ item, isActive, collapsed }: NavLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.title : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        // Base layout
        'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium',
        // Collapse: hide label text but keep icon centered
        collapsed && 'justify-center px-0',
        // Transition
        'transition-colors duration-200',
        // Active state: sky-blue left border bar + subtle bg tint
        isActive
          ? [
              'text-[#0ea5e9]',
              // Left border accent — placed via pseudo via box-shadow to avoid layout shift
              'before:absolute before:inset-y-1 before:left-0 before:w-[3px]',
              'before:rounded-full before:bg-[#0ea5e9] before:content-[""]',
              'bg-[#0ea5e9]/8',
            ]
          : [
              'text-zinc-500 dark:text-zinc-400',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
              'hover:text-zinc-900 dark:hover:text-zinc-100',
            ]
      )}
    >
      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0',
          isActive
            ? 'text-[#0ea5e9]'
            : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300',
          'transition-colors duration-200'
        )}
        aria-hidden="true"
      />
      {!collapsed && <span className="truncate leading-none">{item.title}</span>}
    </Link>
  );
}

// ─── SidebarContent sub-component ────────────────────────────────────────────

interface SidebarContentProps {
  collapsed: boolean;
  navItems: NavItem[];
  pathname: string;
  isAdmin: boolean;
  toggleCollapsed: () => void;
}

function SidebarContent({
  collapsed,
  navItems,
  pathname,
  isAdmin,
  toggleCollapsed,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Spacer to match header height */}
      <div className="h-14 shrink-0" />

      {/* ── Primary navigation ───────────────────────────────────────── */}
      <nav
        aria-label={isAdmin ? '관리자 메뉴' : '사용자 메뉴'}
        className={cn('flex-1 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}
      >
        <ul role="list" className="space-y-1">
          {navItems.map((item) => {
            // Exact match for top-level, prefix match for nested admin routes
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <li key={item.href}>
                <NavLink item={item} isActive={isActive} collapsed={collapsed} />
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Bottom section ───────────────────────────────────────────── */}
      <div className={cn('shrink-0 pb-3', collapsed ? 'px-2' : 'px-3')}>
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
            collapsed && 'justify-center px-0',
            'text-zinc-400 dark:text-zinc-500',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
            'hover:text-zinc-700 dark:hover:text-zinc-300',
            'transition-colors duration-200'
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span className="truncate leading-none">접기</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar({ isAdmin = false, collapsed, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();

  const toggleCollapsed = () => onToggleCollapsed(!collapsed);

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <aside
      aria-label="데스크톱 내비게이션"
      className={cn(
        'fixed left-0 top-0 z-30 hidden h-full md:flex md:flex-col',
        'border-r border-zinc-200 dark:border-zinc-800',
        'bg-white dark:bg-zinc-950',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        navItems={navItems}
        pathname={pathname}
        isAdmin={isAdmin}
        toggleCollapsed={toggleCollapsed}
      />
    </aside>
  );
}
