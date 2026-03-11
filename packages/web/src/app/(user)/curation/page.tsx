'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ExternalLink, Search, Sparkles, X } from 'lucide-react';
import { INTEREST_OPTIONS } from '@blog-study/shared/config';
import { PageError } from '@/components/ui/page-state';
import { getArticleGradient, formatRelativeDate, CATEGORY_STYLES } from '@/lib/curation-utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CurationItemResponse {
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
  items: CurationItemResponse[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

type FilterValue = 'recommended' | 'all' | 'conference' | 'article';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const FILTERS: { value: FilterValue; label: string; emoji: string }[] = [
  { value: 'recommended', label: '맞춤', emoji: '✨' },
  { value: 'all', label: '전체', emoji: '📚' },
  { value: 'conference', label: '컨퍼런스', emoji: '🎤' },
  { value: 'article', label: '아티클', emoji: '📝' },
];

const VALID_CATEGORIES = new Set<string>(['recommended', 'all', 'conference', 'article']);
const PAGE_SIZE = 12;

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

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
  const [prevSrc, setPrevSrc] = useState(src);
  const gradient = useMemo(() => getArticleGradient(title), [title]);
  const catStyle = CATEGORY_STYLES[category] ?? CATEGORY_STYLES['article']!;

  if (src !== prevSrc) {
    setPrevSrc(src);
    setFailed(false);
  }

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
      alt=""
      width={480}
      height={270}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

// ─────────────────────────────────────────────
// TagFilterList — shared between desktop/mobile
// ─────────────────────────────────────────────

function TagFilterList({
  selectedTags,
  onToggle,
  onClear,
}: {
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {INTEREST_OPTIONS.map((tag) => {
        const isSelected = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            aria-pressed={isSelected}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold
              transition-colors cursor-pointer shrink-0
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
              ${isSelected
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border text-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
          >
            #{tag}
          </button>
        );
      })}
      {selectedTags.length > 0 && (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          aria-label="태그 필터 초기화"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          초기화
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CurationCard — mobile / tablet
// ─────────────────────────────────────────────

function CurationCard({ item }: { item: CurationItemResponse }) {
  const catStyle = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES['article']!;
  const relativeDate = formatRelativeDate(item.publishedAt);
  const href = isSafeUrl(item.url) ? item.url : '#';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden
        hover:border-primary/30 hover:shadow-md transition-all duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
        {/* Badges + tags */}
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
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              공유됨
            </span>
          )}
          {item.tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs text-muted-foreground
                bg-muted/60 ring-1 ring-inset ring-border/40"
            >
              #{tag}
            </span>
          ))}
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
          <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 flex-1">
            {item.sourceName && (
              <span className="font-medium truncate max-w-[120px] sm:max-w-[160px]" title={item.sourceName}>
                {item.sourceName}
              </span>
            )}
            {item.sourceName && relativeDate && <span aria-hidden="true">·</span>}
            {relativeDate && <span className="shrink-0 tabular-nums">{relativeDate}</span>}
          </div>
          <span className="sr-only">(새 탭에서 열기)</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors ml-2" aria-hidden="true" />
        </div>
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────
// CurationListRow — desktop list feed
// ─────────────────────────────────────────────

function CurationListRow({ item }: { item: CurationItemResponse }) {
  const catStyle = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES['article']!;
  const relativeDate = formatRelativeDate(item.publishedAt);
  const href = isSafeUrl(item.url) ? item.url : '#';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 py-4 px-3 -mx-3 rounded-lg
        hover:bg-muted/40 transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              공유됨
            </span>
          )}
          {item.tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs text-muted-foreground
                bg-muted/60 ring-1 ring-inset ring-border/40"
            >
              #{tag}
            </span>
          ))}
          {item.sourceName && (
            <span className="text-xs text-muted-foreground font-medium truncate max-w-[160px]" title={item.sourceName}>
              {item.sourceName}
            </span>
          )}
          {item.sourceName && relativeDate && (
            <span className="text-xs text-muted-foreground" aria-hidden="true">·</span>
          )}
          {relativeDate && (
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{relativeDate}</span>
          )}
        </div>
      </div>

      {/* External link icon */}
      <span className="sr-only">(새 탭에서 열기)</span>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors mt-0.5" aria-hidden="true" />
    </a>
  );
}

// ─────────────────────────────────────────────
// CardSkeleton
// ─────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden animate-pulse">
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
  const categoryParam = searchParams.get('category');
  const tagsParam = searchParams.get('tags');
  const searchParam = searchParams.get('search') || '';
  const category: FilterValue = categoryParam && VALID_CATEGORIES.has(categoryParam)
    ? (categoryParam as FilterValue)
    : 'recommended';
  const selectedTags: string[] = tagsParam
    ? tagsParam.split(',').filter(Boolean)
    : [];

  // Local state
  const [items, setItems] = useState<CurationItemResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParam);

  // Refs — use refs for values accessed inside IntersectionObserver to avoid stale closures
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const cursorRef = useRef<string | null>(cursor);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  hasMoreRef.current = hasMore;
  loadingMoreRef.current = loadingMore;
  cursorRef.current = cursor;

  // Sync searchInput with URL on back-navigation
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Fetch ──
  const fetchItems = useCallback(async (
    cat: FilterValue,
    tags: string[],
    search: string,
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
        limit: String(PAGE_SIZE),
      });
      if (cat === 'recommended') {
        params.set('sort', 'recommended');
        params.set('category', 'all');
      } else {
        params.set('category', cat);
      }
      if (tags.length > 0) params.set('tags', tags.join(','));
      if (search) params.set('search', search);
      if (cursorArg) params.set('cursor', cursorArg);

      const response = await fetch(`/api/curation?${params}`);
      if (!response.ok) throw new Error('Failed to fetch curation data');
      const result = await response.json();
      const data: CurationData = result.data;

      if (append) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      // Always update totalCount (non-zero only on first page)
      if (data.totalCount > 0) setTotalCount(data.totalCount);
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
    fetchItems(category, selectedTags, searchParam, null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, tagsParam, searchParam, fetchItems]);

  // ── IntersectionObserver for infinite scroll ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
          fetchItems(category, selectedTags, searchParam, cursorRef.current, true);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, tagsParam, searchParam, fetchItems]);

  // ── URL sync helpers ──
  const updateFilters = (newCategory: FilterValue, newTags: string[], newSearch?: string) => {
    const params = new URLSearchParams();
    if (newCategory !== 'recommended') params.set('category', newCategory);
    if (newTags.length > 0) params.set('tags', newTags.join(','));
    const s = newSearch ?? searchParam;
    if (s) params.set('search', s);
    const qs = params.toString();
    router.push(`/curation${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const handleFilterChange = (value: FilterValue) => {
    updateFilters(value, selectedTags);
  };

  const handleTagToggle = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    updateFilters(category, next);
  };

  const clearTags = () => {
    updateFilters(category, []);
  };

  // ── Search with debounce ──
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateFilters(category, selectedTags, value.trim());
    }, 300);
  };

  const clearSearch = () => {
    setSearchInput('');
    updateFilters(category, selectedTags, '');
  };

  // ── Error state ──
  if (error && items.length === 0) {
    return <PageError message={error} />;
  }

  const showInitialSkeletons = loading && items.length === 0;
  const hasActiveSearch = searchParam.length > 0;

  return (
    <div className="space-y-0">
      {/* Accessible live region for loading state */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading && '콘텐츠를 불러오는 중입니다.'}
        {loadingMore && '추가 콘텐츠를 불러오는 중입니다.'}
      </div>

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
        className="top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/60
          -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 space-y-2.5"
      >
        {/* Search bar */}
        <div role="search" className="relative">
          <label htmlFor="curation-search" className="sr-only">
            큐레이션 콘텐츠 검색
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            id="curation-search"
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="제목, 설명으로 검색..."
            className="w-full pl-9 pr-9 py-2 text-sm bg-muted/50 border border-border/60 rounded-lg
              placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
              transition-colors [&::-webkit-search-cancel-button]:hidden"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center
                w-8 h-8 text-muted-foreground hover:text-foreground transition-colors rounded-full
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="검색어 지우기"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Category pills + tags (desktop: same row / mobile: separate rows) */}
        <div role="group" aria-label="콘텐츠 필터" className="flex items-center gap-2 flex-wrap">
          {/* Category pills */}
          {FILTERS.map(({ value, label, emoji }) => (
            <button
              key={value}
              onClick={() => handleFilterChange(value)}
              aria-pressed={category === value}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium
                transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                ${category === value
                  ? 'bg-foreground text-background shadow-sm motion-safe:scale-105'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 motion-safe:hover:scale-[1.02]'
                }`}
            >
              <span aria-hidden="true">{emoji}</span>
              {label}
            </button>
          ))}

          {/* Separator — desktop only */}
          <div className="hidden lg:block w-px h-5 bg-border/60 mx-1" aria-hidden="true" />

          {/* Desktop tags — inline after categories */}
          <div className="hidden lg:flex">
            <TagFilterList selectedTags={selectedTags} onToggle={handleTagToggle} onClear={clearTags} />
          </div>
        </div>

        {/* Mobile tag toggle */}
        <div className="lg:hidden">
          <button
            onClick={() => setTagsExpanded((prev) => !prev)}
            aria-expanded={tagsExpanded}
            aria-controls="mobile-tag-panel"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground
              transition-colors min-h-[44px] px-1 -mx-1 rounded
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            태그 필터
            {selectedTags.length > 0 && (
              <span className="text-foreground">({selectedTags.length})</span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={`h-3.5 w-3.5 motion-safe:transition-transform motion-safe:duration-200 ${tagsExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          <div
            id="mobile-tag-panel"
            className={`overflow-hidden motion-safe:transition-[max-height] motion-safe:duration-200 motion-safe:ease-in-out ${
              tagsExpanded ? 'max-h-60' : 'max-h-0'
            }`}
            aria-hidden={!tagsExpanded}
          >
            <div className="pt-2">
              <TagFilterList selectedTags={selectedTags} onToggle={handleTagToggle} onClear={clearTags} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="pt-4">
        {showInitialSkeletons ? (
          <>
            <p className="sr-only">콘텐츠를 불러오는 중입니다.</p>
            <div aria-hidden="true">
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
            <div className="text-5xl" aria-hidden="true">
              {hasActiveSearch || selectedTags.length > 0 ? '🔍' : '📭'}
            </div>
            <p className="text-sm text-muted-foreground">
              {hasActiveSearch
                ? '검색 결과가 없어요'
                : selectedTags.length > 0
                  ? '선택한 태그에 맞는 콘텐츠가 없어요'
                  : '아직 큐레이션된 콘텐츠가 없어요'}
            </p>
            {(hasActiveSearch || selectedTags.length > 0) && (
              <button
                onClick={() => {
                  setSearchInput('');
                  updateFilters(category, [], '');
                }}
                className="text-xs text-sky-600 dark:text-primary underline underline-offset-2
                  hover:text-sky-700 dark:hover:text-primary/80 transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                필터 초기화
              </button>
            )}
          </div>
        ) : null}

        {/* Load-more skeletons */}
        {loadingMore && (
          <div aria-hidden="true">
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
          </div>
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
