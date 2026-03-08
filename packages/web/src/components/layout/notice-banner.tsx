'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Megaphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoticeBannerData {
  id: string;
  title: string;
  createdAt: string;
  memberName: string;
}

const STORAGE_KEY = 'notice-banner-state';

type BannerState = 'open' | 'collapsed' | 'closed';

function getSavedState(noticeId: string): BannerState {
  if (typeof window === 'undefined') return 'open';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'open';
    const data = JSON.parse(raw) as { id: string; state: BannerState };
    // Different notice → reset to open
    if (data.id !== noticeId) return 'open';
    return data.state;
  } catch {
    return 'open';
  }
}

function saveState(noticeId: string, state: BannerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: noticeId, state }));
  } catch {
    // ignore
  }
}

export function NoticeBanner() {
  const [notice, setNotice] = useState<NoticeBannerData | null>(null);
  const [bannerState, setBannerState] = useState<BannerState>('open');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/notice-banner')
      .then((res) => res.json())
      .then((result) => {
        if (result.data) {
          setNotice(result.data);
          setBannerState(getSavedState(result.data.id));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || !notice || bannerState === 'closed') return null;

  const handleToggle = () => {
    const next = bannerState === 'open' ? 'collapsed' : 'open';
    setBannerState(next);
    saveState(notice.id, next);
  };

  const handleClose = () => {
    setBannerState('closed');
    saveState(notice.id, 'closed');
  };

  return (
    <div
      className={cn(
        'w-full border-b border-sky-200/60 dark:border-sky-800/40',
        'bg-sky-50/80 dark:bg-sky-950/30',
        'transition-all duration-200'
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 py-2">
          {/* Icon */}
          <Megaphone className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {bannerState === 'open' ? (
              <Link
                href={`/board/${notice.id}`}
                className="group flex items-baseline gap-2 min-w-0"
              >
                <span className="truncate text-sm font-medium text-sky-900 dark:text-sky-100 group-hover:underline">
                  {notice.title}
                </span>
                <span className="shrink-0 text-[11px] text-sky-600/70 dark:text-sky-400/60">
                  {notice.memberName}
                </span>
              </Link>
            ) : (
              <button
                onClick={handleToggle}
                className="text-xs text-sky-600/80 dark:text-sky-400/70 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
              >
                공지사항 보기
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={handleToggle}
              className="p-1 rounded-md text-sky-500/70 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-100/60 dark:hover:bg-sky-900/40 transition-colors"
              aria-label={bannerState === 'open' ? '공지 접기' : '공지 펼치기'}
            >
              {bannerState === 'open' ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-1 rounded-md text-sky-500/70 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-100/60 dark:hover:bg-sky-900/40 transition-colors"
              aria-label="공지 닫기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
