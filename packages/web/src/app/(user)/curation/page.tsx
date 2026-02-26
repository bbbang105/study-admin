'use client';

import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Calendar, Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { INTEREST_OPTIONS } from '@blog-study/shared/config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageError } from '@/components/ui/page-state';
import { TagList } from '@/components/ui/tag-list';

interface CurationItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  category: string;
  tags: string[] | null;
  relevanceScore: number;
  sharedAt: string | null;
  sourceName: string | null;
}

interface CurationData {
  items: CurationItem[];
  totalCount: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

type FilterValue = 'all' | 'conference' | 'article';

const CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  conference: {
    label: '컨퍼런스',
    bg: 'bg-violet-100 dark:bg-violet-500/20',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200 dark:ring-violet-500/30',
  },
  article: {
    label: '아티클',
    bg: 'bg-sky-100 dark:bg-sky-500/20',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200 dark:ring-sky-500/30',
  },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

const FILTERS: { value: FilterValue; label: string; emoji: string }[] = [
  { value: 'all', label: '전체', emoji: '📚' },
  { value: 'conference', label: '컨퍼런스', emoji: '🎤' },
  { value: 'article', label: '아티클', emoji: '📝' },
];

const MAX_TAGS = 4;

export default function CurationPage() {
  const [data, setData] = useState<CurationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const fetchCuration = useCallback(async (cat: FilterValue, tags: string[], p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category: cat, page: String(p), limit: '12' });
      if (tags.length > 0) {
        params.set('tags', tags.join(','));
      }
      const response = await fetch(`/api/curation?${params}`);
      if (!response.ok) throw new Error('Failed to fetch curation data');
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError('큐레이션 데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCuration(filter, selectedTags, page);
  }, [filter, selectedTags, page, fetchCuration]);

  const handleFilterChange = (value: FilterValue) => {
    setFilter(value);
    setPage(1);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, tag];
    });
    setPage(1);
  };

  const clearTags = () => {
    setSelectedTags([]);
    setPage(1);
  };

  if (error) {
    return <PageError message={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Curation
        </p>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <h1 className="text-xl font-semibold text-foreground">큐레이션</h1>
          <span className="text-sm text-muted-foreground">
            {data?.totalCount ?? 0}개의 콘텐츠
          </span>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label, emoji }) => (
          <button
            key={value}
            onClick={() => handleFilterChange(value)}
            className={`
              inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium
              transition-all duration-200
              ${filter === value
                ? 'bg-foreground text-background shadow-sm scale-105'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:scale-[1.02]'
              }
            `}
          >
            <span>{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Tag Filter — INTEREST_OPTIONS 기반 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            관심 태그 필터
            {selectedTags.length > 0 && (
              <span className="ml-1 text-foreground">
                ({selectedTags.length}/{MAX_TAGS})
              </span>
            )}
          </span>
          {selectedTags.length > 0 && (
            <button
              onClick={clearTags}
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              초기화
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {INTEREST_OPTIONS.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
              className={`cursor-pointer transition-colors text-xs ${
                !selectedTags.includes(tag) && selectedTags.length >= MAX_TAGS
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              onClick={() => handleTagToggle(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 p-5 space-y-3 animate-pulse"
            >
              <div className="h-5 w-16 bg-muted rounded-full" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-5 w-12 bg-muted rounded-full" />
                <div className="h-5 w-14 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        /* Card Grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => {
            const catStyle = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES['article']!;
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative rounded-xl border border-border/60 p-5 space-y-3
                  hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5
                  transition-all duration-200 bg-card"
              >
                {/* Category Badge + Shared */}
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${catStyle.bg} ${catStyle.text} ${catStyle.ring}`}>
                    {catStyle.label}
                  </span>
                  {item.sharedAt && (
                    <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30">
                      <Sparkles className="h-3 w-3" />
                      공유됨
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-relaxed">
                  {item.title}
                </h3>

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <TagList tags={item.tags} />
                )}

                {/* Footer: source + date + link icon */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {item.sourceName && (
                      <span className="font-medium">{item.sourceName}</span>
                    )}
                    {item.sourceName && item.publishedAt && (
                      <span>·</span>
                    )}
                    {item.publishedAt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(item.publishedAt)}</span>
                      </div>
                    )}
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-5xl">{selectedTags.length > 0 ? '🔍' : '📭'}</div>
          <p className="text-sm text-muted-foreground">
            {selectedTags.length > 0
              ? '선택한 태그에 맞는 콘텐츠가 없어요'
              : '아직 큐레이션된 콘텐츠가 없어요'}
          </p>
          {selectedTags.length > 0 && (
            <button
              onClick={clearTags}
              className="text-xs text-primary hover:underline"
            >
              태그 필터 초기화
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (() => {
        const total = data.pagination.totalPages;
        const maxVisible = 10;
        let start = Math.max(1, page - Math.floor(maxVisible / 2));
        const end = Math.min(total, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) {
          start = Math.max(1, end - maxVisible + 1);
        }
        const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

        return (
          <div className="flex flex-wrap items-center justify-center gap-1 pt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {start > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(1)}
                >
                  1
                </Button>
                {start > 2 && (
                  <span className="text-xs text-muted-foreground px-1">...</span>
                )}
              </>
            )}
            {pages.map((p) => (
              <Button
                key={p}
                variant={p === page ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ))}
            {end < total && (
              <>
                {end < total - 1 && (
                  <span className="text-xs text-muted-foreground px-1">...</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(total)}
                >
                  {total}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={page >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        );
      })()}
    </div>
  );
}
