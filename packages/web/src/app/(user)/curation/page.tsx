'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Sparkles, X } from 'lucide-react';
import { INTEREST_OPTIONS } from '@blog-study/shared/config';
import { Badge } from '@/components/ui/badge';
import { PageError } from '@/components/ui/page-state';
import { getArticleGradient, formatRelativeDate, CATEGORY_STYLES } from '@/lib/curation-utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CurationItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  category: string;
  tags: string[] | null;
  relevanceScore: number;
  sharedAt: string | null;
  sourceName: string | null;
}

interface CurationData {
  items: CurationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

type FilterValue = 'all' | 'conference' | 'article';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const FILTERS: { value: FilterValue; label: string; emoji: string }[] = [
  { value: 'all', label: '전체', emoji: '📚' },
  { value: 'conference', label: '컨퍼런스', emoji: '🎤' },
  { value: 'article', label: '아티클', emoji: '📝' },
];

const MAX_TAGS = 4;
const PAGE_SIZE = 12;

// ─────────────────────────────────────────────
// Thumbnail — img with gradient fallback
// ─────────────────────────────────────────────

interface ThumbnailProps {
  src: string | null;
  title: string;
  category: string;
  className?: string;
}

function Thumbnail({ src, title, category, className = '' }: ThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const gradient = getArticleGradient(title);
  const catStyle = CATEGORY_STYLES[category] ?? CATEGORY_STYLES['article']!;

  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br ${gradient} flex items-center justify-center ${className}`}
        aria-hidden="true"
      >
        <span className="text-2xl select-none">{catStyle.emoji}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

// ─────────────────────────────────────────────
// CurationCard — mobile / tablet
// ─────────────────────────────────────────────

function CurationCard({ item }: { item: CurationItem }) {
  const catStyle = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES['article']!;
  const relativeDate = formatRelativeDate(item.publishedAt);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden
        hover:border-primary/30 hover:shadow-md transition-all duration-200"
    >
      {/* 16:9 thumbnail */}
      <div className="aspect-video w-full overflow-hidden bg-muted">
        <Thumbnail
          src={item.thumbnailUrl}
          title={item.title}
          category={item.category}
          className="w-full h-full"
        />
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 gap-2 p-3">
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset
              ${catStyle.bg} ${catStyle.text} ${catStyle.ring}`}
          >
            {catStyle.label}
          </span>
          {item.sharedAt && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium
              bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200
              dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30">
              <Sparkles className="h-3 w-3" />
              공유됨
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug
          group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
            {item.sourceName && (
              <span className="font-medium truncate max-w-[80px]">{item.sourceName}</span>
            )}
            {item.sourceName && relativeDate && <span>·</span>}
            {relativeDate && <span className="shrink-0">{relativeDate}</span>}
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors ml-2" />
        </div>
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────
// CurationListRow — desktop list feed
// ─────────────────────────────────────────────

function CurationListRow({ item }: { item: CurationItem }) {
  const catStyle = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES['article']!;
  const relativeDate = formatRelativeDate(item.publishedAt);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 py-4 px-3 -mx-3 rounded-lg
        hover:bg-muted/40 transition-colors duration-150"
    >
      {/* Thumbnail */}
      <div className="w-[100px] h-[64px] shrink-0 rounded-md overflow-hidden bg-muted">
        <Thumbnail
          src={item.thumbnailUrl}
          title={item.title}
          category={item.category}
          className="w-full h-full"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 min-w-0 gap-1.5">
        {/* Title */}
        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug
          group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Footer meta */}
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset
              ${catStyle.bg} ${catStyle.text} ${catStyle.ring}`}
          >
            {catStyle.label}
          </span>
          {item.sharedAt && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium
              bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200
              dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30">
              <Sparkles className="h-3 w-3" />
              공유됨
            </span>
          )}
          {item.sourceName && (
            <span className="text-xs text-muted-foreground font-medium">{item.sourceName}</span>
          )}
          {relativeDate && (
            <span className="text-xs text-muted-foreground">{relativeDate}</span>
          )}
        </div>
      </div>

      {/* External link icon */}
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors mt-0.5" />
    </a>
  );
}

// ─────────────────────────────────────────────
// CardSkeleton
// ─────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden animate-pulse">
      {/* thumbnail placeholder */}
      <div className="aspect-video w-full bg-muted" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-4 w-16 bg-muted rounded-full" />
        <div className="space-y-1.5">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-3/4 bg-muted rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-full bg-muted rounded" />
          <div className="h-3 w-5/6 bg-muted rounded" />
          <div className="h-3 w-4/6 bg-muted rounded" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-3.5 w-3.5 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ListRowSkeleton
// ─────────────────────────────────────────────

function ListRowSkeleton() {
  return (
    <div className="flex items-start gap-4 py-4 px-3 -mx-3 animate-pulse">
      <div className="w-[100px] h-[64px] shrink-0 rounded-md bg-muted" />
      <div className="flex flex-col flex-1 min-w-0 gap-1.5">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="flex items-center gap-2 mt-0.5">
          <div className="h-4 w-14 bg-muted rounded-full" />
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-3 w-10 bg-muted rounded" />
        </div>
      </div>
      <div className="h-4 w-4 shrink-0 bg-muted rounded" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Main: CurationPage
// ─────────────────────────────────────────────

export default function CurationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive filter state from URL
  const categoryParam = searchParams.get('category') as FilterValue | null;
  const tagsParam = searchParams.get('tags');
  const category: FilterValue = categoryParam && ['all', 'conference', 'article'].includes(categoryParam)
    ? categoryParam
    : 'all';
  const selectedTags: string[] = tagsParam
    ? tagsParam.split(',').filter(Boolean)
    : [];

  // Local state
  const [items, setItems] = useState<CurationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sentinel ref for IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Keep a ref to avoid stale closure in observer callback
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  hasMoreRef.current = hasMore;
  loadingMoreRef.current = loadingMore;

  // ── Fetch ──
  const fetchItems = useCallback(async (
    cat: FilterValue,
    tags: string[],
    cursorArg: string | null,
    append: boolean
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const params = new URLSearchParams({
        category: cat,
        limit: String(PAGE_SIZE),
      });
      if (tags.length > 0) params.set('tags', tags.join(','));
      if (cursorArg) params.set('cursor', cursorArg);

      const response = await fetch(`/api/curation?${params}`);
      if (!response.ok) throw new Error('Failed to fetch curation data');
      const result = await response.json();
      const data: CurationData = result.data;

      if (append) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
        setTotalCount(data.totalCount);
      }
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (err) {
      setError('큐레이션 데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // ── Initial / filter-change fetch ──
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(false);
    fetchItems(category, selectedTags, null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, tagsParam, fetchItems]);

  // ── IntersectionObserver for infinite scroll ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
          fetchItems(category, selectedTags, cursor, true);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // cursor changes should re-bind observer so we can load the next page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, category, tagsParam, fetchItems]);

  // ── URL sync helpers ──
  const updateFilters = (newCategory: FilterValue, newTags: string[]) => {
    const params = new URLSearchParams();
    if (newCategory !== 'all') params.set('category', newCategory);
    if (newTags.length > 0) params.set('tags', newTags.join(','));
    const qs = params.toString();
    router.push(`/curation${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const handleFilterChange = (value: FilterValue) => {
    updateFilters(value, selectedTags);
  };

  const handleTagToggle = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : selectedTags.length >= MAX_TAGS
        ? selectedTags
        : [...selectedTags, tag];
    updateFilters(category, next);
  };

  const clearTags = () => {
    updateFilters(category, []);
  };

  // ── Error state ──
  if (error && items.length === 0) {
    return <PageError message={error} />;
  }

  const showInitialSkeletons = loading && items.length === 0;

  return (
    <div className="space-y-0">
      {/* ── Header ── */}
      <div className="space-y-1 pb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Curation
        </p>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <h1 className="text-xl font-semibold text-foreground">큐레이션</h1>
          {!loading && (
            <span className="text-sm text-muted-foreground">
              {totalCount}개의 콘텐츠
            </span>
          )}
        </div>
      </div>

      {/* ── Sticky filter bar ── */}
      <div
        className="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/60
          -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 space-y-2.5"
      >
        {/* Category pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(({ value, label, emoji }) => (
            <button
              key={value}
              onClick={() => handleFilterChange(value)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium
                transition-all duration-200
                ${category === value
                  ? 'bg-foreground text-background shadow-sm scale-105'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:scale-[1.02]'
                }`}
            >
              <span>{emoji}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Tag chips */}
        <div className="flex items-center gap-2">
          {/* Label + clear */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">
              태그
              {selectedTags.length > 0 && (
                <span className="ml-1 text-foreground">({selectedTags.length}/{MAX_TAGS})</span>
              )}
            </span>
            {selectedTags.length > 0 && (
              <button
                onClick={clearTags}
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-label="태그 필터 초기화"
              >
                <X className="h-3 w-3" />
                <span className="hidden sm:inline">초기화</span>
              </button>
            )}
          </div>

          {/* Mobile: horizontal scroll / PC: wrap */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide lg:flex-wrap">
            {INTEREST_OPTIONS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              const isDisabled = !isSelected && selectedTags.length >= MAX_TAGS;
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`cursor-pointer transition-colors text-xs shrink-0
                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  onClick={() => !isDisabled && handleTagToggle(tag)}
                >
                  {tag}
                </Badge>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="pt-4">
        {showInitialSkeletons ? (
          <>
            {/* Card skeletons — mobile/tablet */}
            <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            {/* List skeletons — desktop */}
            <div className="hidden lg:block divide-y divide-border/40">
              {Array.from({ length: 8 }).map((_, i) => (
                <ListRowSkeleton key={i} />
              ))}
            </div>
          </>
        ) : items.length > 0 ? (
          <>
            {/* Card grid — mobile / tablet */}
            <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
              {items.map((item) => (
                <CurationCard key={item.id} item={item} />
              ))}
            </div>

            {/* List feed — desktop */}
            <div className="hidden lg:block divide-y divide-border/40">
              {items.map((item) => (
                <CurationListRow key={item.id} item={item} />
              ))}
            </div>
          </>
        ) : !loading ? (
          /* Empty state */
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
        ) : null}

        {/* Load-more skeletons */}
        {loadingMore && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:hidden mt-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            <div className="hidden lg:block divide-y divide-border/40">
              {Array.from({ length: 3 }).map((_, i) => (
                <ListRowSkeleton key={i} />
              ))}
            </div>
          </>
        )}

        {/* Sentinel — IntersectionObserver target */}
        <div ref={sentinelRef} className="h-px" aria-hidden="true" />

        {/* End indicator */}
        {!hasMore && !loading && items.length > 0 && (
          <div className="flex flex-col items-center gap-1.5 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {totalCount}개 모두 확인했어요
            </p>
            <p className="text-xs text-muted-foreground">
              새 콘텐츠는 매일 업데이트됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
