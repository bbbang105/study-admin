'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLogTypeMeta, notificationLogTypeConfig } from '@/lib/notification-log-config';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  source: string;
  type: string;
  channelId: string | null;
  channelName: string | null;
  targetDiscordId: string | null;
  messageId: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

const ALL_TYPES = Object.entries(notificationLogTypeConfig).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export default function NotificationLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterTarget, setFilterTarget] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchLogs = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterSource) params.set('source', filterSource);
      if (filterTarget) params.set('target', filterTarget);
      if (filterStatus) params.set('status', filterStatus);
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/admin/bot-logs?${params.toString()}`);
      if (!res.ok) throw new Error('로그를 불러오는데 실패했습니다');
      const json = await res.json();
      return json.data as { logs: LogEntry[]; nextCursor: string | null; hasMore: boolean };
    },
    [filterType, filterSource, filterTarget, filterStatus]
  );

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLogs();
      setLogs(data.logs);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error(err);
      toast.error('알림 로그를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [fetchLogs]);

  const isLoadingMoreRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const data = await fetchLogs(nextCursor);
      setLogs((prev) => [...prev, ...data.logs]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error(err);
      toast.error('추가 로그를 불러오는데 실패했습니다');
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchLogs, hasMore, nextCursor]);

  // Reset when filters change
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '100px' }
    );
    if (bottomRef.current) {
      observerRef.current.observe(bottomRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterType || '_all'} onValueChange={(v) => setFilterType(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-[90px] sm:w-36 h-8 text-xs">
            <SelectValue placeholder="전체 타입" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 타입</SelectItem>
            {ALL_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSource || '_all'} onValueChange={(v) => setFilterSource(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-20 sm:w-28 h-8 text-xs">
            <SelectValue placeholder="전체 출처" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체</SelectItem>
            <SelectItem value="bot">봇</SelectItem>
            <SelectItem value="web">웹</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterTarget || '_all'} onValueChange={(v) => setFilterTarget(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-20 sm:w-28 h-8 text-xs">
            <SelectValue placeholder="전체 대상" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체</SelectItem>
            <SelectItem value="channel">채널</SelectItem>
            <SelectItem value="dm">DM</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus || '_all'} onValueChange={(v) => setFilterStatus(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-20 sm:w-28 h-8 text-xs">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체</SelectItem>
            <SelectItem value="sent">성공</SelectItem>
            <SelectItem value="failed">실패</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
          표시할 로그가 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const meta = getLogTypeMeta(log.type);
            const isSent = log.status === 'sent';
            const isDM = log.targetDiscordId != null;

            return (
              <Card key={log.id} className="py-0">
                <CardContent className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {/* Status dot */}
                    <span
                      role="img"
                      aria-label={isSent ? '성공' : '실패'}
                      className={cn(
                        'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2',
                        isSent
                          ? 'bg-green-500 ring-green-500/20'
                          : 'bg-red-500 ring-red-500/20'
                      )}
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Top row: badges + destination + time */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge
                          variant="secondary"
                          className={cn('text-xs px-1.5 py-0', meta.color)}
                        >
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {log.source === 'bot' ? '봇' : '웹'}
                        </Badge>
                        <span className="truncate">
                          {isDM
                            ? `DM → ${log.targetDiscordId}`
                            : log.channelName
                              ? `#${log.channelName}`
                              : log.channelId
                                ? `#${log.channelId}`
                                : '—'}
                        </span>
                        <span className="ml-auto shrink-0">{formatRelativeTime(log.createdAt)}</span>
                      </div>

                      {/* Summary */}
                      {log.summary && (
                        <p className="text-sm text-foreground/80 truncate">{log.summary}</p>
                      )}

                      {/* Error message */}
                      {!isSent && log.errorMessage && (
                        <p className="text-xs text-red-500 break-all">{log.errorMessage}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Infinite scroll sentinel */}
          <div ref={bottomRef} className="h-4" />

          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
