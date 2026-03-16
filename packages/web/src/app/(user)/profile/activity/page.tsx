'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageError } from '@/components/ui/page-state';
import { cn, getTimeAgo } from '@/lib/utils';
import { SCORE_TYPE_MAP, SCORE_TYPE_META } from '@/lib/score-config';

interface ScoreRecord {
  id: string;
  type: string;
  points: number;
  description: string | null;
  date: string;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function ActivityPage() {
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const fetchRecords = useCallback(async (
    offsetVal: number,
    append: boolean,
    type: string | null,
    signal?: AbortSignal,
  ) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const typeParam = type ? `&type=${encodeURIComponent(type)}` : '';
      const res = await fetch(`/api/scores?limit=20&offset=${offsetVal}${typeParam}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      if (result.success) {
        setRecords((prev) => append ? [...prev, ...result.data.records] : result.data.records);
        setTotalScore(result.data.totalScore ?? 0);
        setTotal(result.data.total ?? 0);
        setOffset(offsetVal + (result.data.records?.length ?? 0));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!append) setError('활동 내역을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setRecords([]);
    fetchRecords(0, false, filterType, controller.signal);
    return () => controller.abort();
  }, [fetchRecords, filterType]);

  const handleFilterChange = (type: string | null) => {
    setFilterType(type);
  };

  if (error) return <PageError message={error} />;

  const filterTypes = [
    { key: null, label: '전체' },
    ...SCORE_TYPE_META.map((m) => ({ key: m.type, label: `${m.emoji} ${m.label}` })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          프로필
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Activity
            </p>
            <h1 className="text-xl font-semibold tracking-tight">활동 내역</h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight tabular-nums">
              {totalScore.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">pt</span>
            </p>
            <p className="text-xs text-muted-foreground">누적 점수</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {filterTypes.map((f) => (
          <button
            key={f.key ?? 'all'}
            onClick={() => handleFilterChange(f.key)}
            aria-pressed={filterType === f.key}
            className={cn(
              'inline-flex h-7 items-center rounded-full px-2.5 text-xs whitespace-nowrap transition-all shrink-0',
              filterType === f.key
                ? 'bg-foreground text-background font-semibold'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Records */}
      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-medium">
                {filterType ? (SCORE_TYPE_MAP.get(filterType)?.label ?? filterType) : '전체'} 내역
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{total}건</span>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-4">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-4 flex-1 max-w-[200px] bg-muted rounded" />
                  <div className="h-4 w-10 bg-muted rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Zap className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">아직 활동 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="divide-y divide-border/40">
                {records.map((record) => {
                  const config = SCORE_TYPE_MAP.get(record.type) ?? {
                    label: record.type,
                    emoji: '⭐',
                    badgeClass: 'bg-muted text-muted-foreground border-border',
                  };
                  return (
                    <div
                      key={record.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <Badge
                        className={cn(
                          'border text-[10px] font-medium shrink-0 px-1.5 py-0.5',
                          config.badgeClass
                        )}
                      >
                        {config.emoji} {config.label}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">
                          {record.description || config.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {getTimeAgo(record.createdAt)} · {formatDate(record.date)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-bold tabular-nums shrink-0',
                          record.points >= 0 ? 'text-emerald-600' : 'text-rose-500'
                        )}
                      >
                        {record.points >= 0 ? '+' : ''}
                        {record.points}pt
                      </span>
                    </div>
                  );
                })}
              </div>
              {records.length < total && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => fetchRecords(offset, true, filterType)}
                  disabled={loadingMore}
                >
                  {loadingMore ? '불러오는 중...' : '더 보기'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
