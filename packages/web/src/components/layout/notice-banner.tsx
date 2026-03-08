'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoticeBannerData {
  id: string;
  title: string;
  contentText: string;
  createdAt: string;
  memberName: string;
}

const STORAGE_KEY = 'notice-banner-state';

function isClosed(noticeId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as { id: string; closed: boolean };
    // Different notice → show again
    if (data.id !== noticeId) return false;
    return data.closed;
  } catch {
    return false;
  }
}

function setClosed(noticeId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: noticeId, closed: true }));
  } catch {
    // ignore
  }
}

export function NoticeBanner() {
  const [notice, setNotice] = useState<NoticeBannerData | null>(null);
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/notice-banner')
      .then((res) => res.json())
      .then((result) => {
        if (result.data) {
          setNotice(result.data);
          setVisible(!isClosed(result.data.id));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || !notice || !visible) return null;

  const handleClose = () => {
    setVisible(false);
    setClosed(notice.id);
  };

  // Truncate content preview
  const preview =
    notice.contentText.length > 80
      ? notice.contentText.slice(0, 80) + '…'
      : notice.contentText;

  return (
    <div
      className={cn(
        'w-full border-b border-sky-200/60 dark:border-sky-800/40',
        'bg-sky-50/80 dark:bg-sky-950/30'
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-start gap-2.5 py-2.5">
          {/* Icon */}
          <Megaphone className="h-4 w-4 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />

          {/* Content */}
          <Link
            href={`/board/${notice.id}`}
            className="group flex-1 min-w-0"
          >
            <p className="truncate text-sm font-semibold text-sky-900 dark:text-sky-100 group-hover:underline">
              {notice.title}
            </p>
            <p className="mt-0.5 text-xs text-sky-700/70 dark:text-sky-300/60 line-clamp-1">
              {preview}
            </p>
          </Link>

          {/* Close */}
          <button
            onClick={handleClose}
            className="p-1 mt-0.5 shrink-0 rounded-md text-sky-500/70 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-100/60 dark:hover:bg-sky-900/40 transition-colors"
            aria-label="공지 닫기"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
