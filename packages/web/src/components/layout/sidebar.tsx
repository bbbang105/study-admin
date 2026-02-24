'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Trophy,
  Newspaper,
  UsersRound,
  Users,
  CalendarCheck,
  Banknote,
  Settings,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen?: boolean;    // mobile drawer open state
  onClose?: () => void; // mobile close handler
  isAdmin?: boolean;   // show admin nav
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// ─── Navigation data ──────────────────────────────────────────────────────────

const userNavItems: NavItem[] = [
  { title: '대시보드',     href: '/dashboard', icon: LayoutDashboard },
  { title: '글 목록',      href: '/posts',     icon: FileText },
  { title: '랭킹',         href: '/ranking',   icon: Trophy },
  { title: '큐레이션',     href: '/curation',  icon: Newspaper },
  { title: '스터디원 목록', href: '/members',   icon: UsersRound },
];

const adminNavItems: NavItem[] = [
  { title: '관리자 홈',    href: '/admin',              icon: LayoutDashboard },
  { title: '멤버 관리',    href: '/admin/members',      icon: Users },
  { title: '출석 관리',    href: '/admin/attendance',   icon: CalendarCheck },
  { title: '벌금 관리',    href: '/admin/fines',        icon: Banknote },
  { title: '큐레이션 소스', href: '/admin/curation',    icon: Newspaper },
  { title: '설정',         href: '/admin/settings',     icon: Settings },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'study-sidebar-collapsed';

// ─── NavLink sub-component ────────────────────────────────────────────────────

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
}

function NavLink({ item, isActive, collapsed, onClick }: NavLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.title : undefined}
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
      />
      {!collapsed && (
        <span className="truncate leading-none">{item.title}</span>
      )}
    </Link>
  );
}

// ─── SidebarContent sub-component ────────────────────────────────────────────

interface SidebarContentProps {
  mobile?: boolean;
  onClose?: () => void;
  collapsed: boolean;
  navItems: NavItem[];
  pathname: string;
  isAdmin: boolean;
  toggleCollapsed: () => void;
}

function SidebarContent({
  mobile = false,
  onClose,
  collapsed,
  navItems,
  pathname,
  isAdmin,
  toggleCollapsed,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">

      {/* ── Mobile header: logo + close ────────────────────────────── */}
      {mobile && (
        <div className="flex h-14 shrink-0 items-center border-b border-zinc-200 dark:border-zinc-800 px-5">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2 select-none"
          >
            <span className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50">BS</span>
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 tracking-wide uppercase">
              Blog Study
            </span>
          </Link>
          <button
            onClick={onClose}
            aria-label="사이드바 닫기"
            className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Desktop: spacer to match header height */}
      {!mobile && (
        <div className="h-14 shrink-0" />
      )}

      {/* ── Primary navigation ───────────────────────────────────────── */}
      <nav
        aria-label={isAdmin ? '관리자 메뉴' : '사용자 메뉴'}
        className={cn(
          'flex-1 overflow-y-auto py-3',
          collapsed && !mobile ? 'px-2' : 'px-3'
        )}
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
                <NavLink
                  item={item}
                  isActive={isActive}
                  collapsed={collapsed && !mobile}
                  onClick={mobile ? onClose : undefined}
                />
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Bottom section ───────────────────────────────────────────── */}
      <div
        className={cn(
          'shrink-0',
          collapsed && !mobile ? 'px-2' : 'px-3'
        )}
      >
        <Separator className="mb-3" />

        {/* User / Admin page toggle link */}
        <div className="mb-2">
          {isAdmin ? (
            <Link
              href="/dashboard"
              onClick={mobile ? onClose : undefined}
              title={collapsed && !mobile ? '사용자 페이지' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                collapsed && !mobile && 'justify-center px-0',
                'text-zinc-500 dark:text-zinc-400',
                'hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
                'hover:text-zinc-900 dark:hover:text-zinc-100',
                'transition-colors duration-200'
              )}
            >
              <LayoutDashboard
                className={cn(
                  'h-4 w-4 shrink-0 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200'
                )}
              />
              {(!collapsed || mobile) && (
                <span className="truncate leading-none">사용자 페이지</span>
              )}
            </Link>
          ) : (
            <Link
              href="/admin"
              onClick={mobile ? onClose : undefined}
              title={collapsed && !mobile ? '관리자' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                collapsed && !mobile && 'justify-center px-0',
                'text-zinc-500 dark:text-zinc-400',
                'hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
                'hover:text-zinc-900 dark:hover:text-zinc-100',
                'transition-colors duration-200'
              )}
            >
              <Shield
                className={cn(
                  'h-4 w-4 shrink-0 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200'
                )}
              />
              {(!collapsed || mobile) && (
                <span className="truncate leading-none">관리자</span>
              )}
            </Link>
          )}
        </div>

        {/* Collapse toggle — desktop only (hidden inside mobile drawer) */}
        {!mobile && (
          <div className="mb-3">
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
        )}
      </div>
    </div>
  );
}

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar({ isOpen = false, onClose, isAdmin = false }: SidebarProps) {
  const pathname = usePathname();

  // Persist collapsed state in localStorage
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  // Keep localStorage in sync whenever collapsed changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <>
      {/* ── Mobile: overlay backdrop + drawer ──────────────────────── */}
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden',
          'transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* Mobile drawer */}
      <aside
        aria-label="모바일 내비게이션"
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-60 md:hidden',
          'border-r border-zinc-200 dark:border-zinc-800',
          'bg-white dark:bg-zinc-950',
          'shadow-xl',
          'transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent
          mobile
          onClose={onClose}
          collapsed={collapsed}
          navItems={navItems}
          pathname={pathname}
          isAdmin={isAdmin}
          toggleCollapsed={toggleCollapsed}
        />
      </aside>

      {/* ── Desktop: fixed sidebar ──────────────────────────────────── */}
      <aside
        aria-label="데스크톱 내비게이션"
        data-collapsed={collapsed}
        className={cn(
          'fixed left-0 top-0 z-30 hidden h-full md:flex md:flex-col',
          'border-r border-zinc-200 dark:border-zinc-800',
          'bg-white dark:bg-zinc-950',
          // Width transitions between expanded (240px) and collapsed (64px)
          'transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <SidebarContent
          onClose={onClose}
          collapsed={collapsed}
          navItems={navItems}
          pathname={pathname}
          isAdmin={isAdmin}
          toggleCollapsed={toggleCollapsed}
        />
      </aside>
    </>
  );
}

// ─── Hook: expose collapsed state for layout offset ───────────────────────────
// Consumers can import this hook to read the sidebar width for layout shifts.
export function useSidebarCollapsed(): boolean {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setCollapsed(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);

    // Also observe direct changes from same tab via a MutationObserver on the aside[data-collapsed]
    const observer = new MutationObserver(() => {
      const aside = document.querySelector('aside[data-collapsed]');
      if (aside) {
        setCollapsed(aside.getAttribute('data-collapsed') === 'true');
      }
    });

    const target = document.querySelector('aside[data-collapsed]');
    if (target) {
      observer.observe(target, { attributes: true, attributeFilter: ['data-collapsed'] });
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      observer.disconnect();
    };
  }, []);

  return collapsed;
}
