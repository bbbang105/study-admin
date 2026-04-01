'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

// Synced with REACTION_EMOJIS in packages/shared/src/db/schema.ts (server validates)
const EMOJIS = ['👍', '👀', '🔥', '💡', '😂', '✅'] as const;

const LONG_PRESS_MS = 500;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ReactionData {
  count: number;
  members: { id: string; nickname: string }[];
  reacted: boolean;
}

interface ReactionBarProps {
  postId: string;
  apiPath?: 'board' | 'posts';
  reactions: Record<string, ReactionData>;
  onUpdate: () => void;
}

// ─────────────────────────────────────────────
// MemberPopover (hover on desktop, long-press on mobile)
// ─────────────────────────────────────────────

function MemberPopover({
  members,
  children,
}: {
  members: { id: string; nickname: string }[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setOpen(true);
    }, LONG_PRESS_MS);
  }, []);

  const handlePointerUp = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handlePointerCancel = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      didLongPress.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  if (members.length === 0) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="inline-flex"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onClickCapture={handleClick}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-56 p-2.5"
        side="top"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-0.5">
          {members.map((m) => (
            <p key={m.id} className="text-xs text-popover-foreground truncate">
              {m.nickname}
            </p>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────
// ReactionBar — Slim toolbar style
// ─────────────────────────────────────────────

export function ReactionBar({ postId, apiPath = 'board', reactions, onUpdate }: ReactionBarProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const toggle = useCallback(
    async (emoji: string) => {
      if (loading) return;
      setLoading(emoji);
      try {
        const res = await fetch(`/api/${apiPath}/${postId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          toast.error(data?.message || '리액션 처리에 실패했습니다.');
          return;
        }
        onUpdate();
      } catch {
        toast.error('리액션 처리에 실패했습니다.');
      } finally {
        setLoading(null);
      }
    },
    [apiPath, postId, loading, onUpdate],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const activeEmojis = EMOJIS.filter((e) => (reactions[e]?.count ?? 0) > 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* 활성 이모지 칩 — 호버/클릭 시 닉네임 팝오버 */}
      {activeEmojis.map((emoji) => {
        const r = reactions[emoji]!;
        return (
          <MemberPopover key={emoji} members={r.members}>
            <button
              type="button"
              disabled={loading === emoji}
              onClick={() => toggle(emoji)}
              aria-label={`${emoji} 리액션, ${r.count}명`}
              aria-pressed={r.reacted}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors select-none',
                r.reacted
                  ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70',
                loading === emoji && 'opacity-50 pointer-events-none',
              )}
            >
              <span className="text-sm leading-none">{emoji}</span>
              <span className="tabular-nums">{r.count}</span>
            </button>
          </MemberPopover>
        );
      })}

      {/* 리액션 추가 피커 */}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-dashed border-border/60 text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
            aria-label="리액션 추가"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          className="w-auto p-1.5"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-0.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  toggle(emoji);
                }}
                disabled={loading === emoji}
                className={cn(
                  'h-8 w-8 rounded-md text-base flex items-center justify-center hover:bg-muted/80 transition-colors',
                  reactions[emoji]?.reacted && 'bg-sky-50 dark:bg-sky-950/40',
                  loading === emoji && 'opacity-50',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
