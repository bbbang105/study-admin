# Curation UX/UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 큐레이션 페이지를 모바일 무한스크롤 피드 + PC 리스트 피드로 개선하고, RSS description/og:image를 저장하여 풍부한 콘텐츠 탐색 경험 제공

**Architecture:** DB에 description/thumbnailUrl 컬럼 추가 → 크롤링 파이프라인에서 RSS description + og:image 추출/저장 → API를 cursor 기반 페이지네이션으로 변경 → 프론트엔드를 반응형 무한스크롤 피드로 전면 리디자인

**Tech Stack:** Drizzle ORM, Next.js App Router, React 19, shadcn/ui, Tailwind CSS v4, cheerio (og:image 파싱), IntersectionObserver

---

## Task 1: DB 스키마 — curationItems에 description, thumbnailUrl 컬럼 + 인덱스 추가

**Files:**
- Modify: `packages/shared/src/db/schema.ts:240-258`

**Step 1: 스키마에 컬럼 및 인덱스 추가**

`packages/shared/src/db/schema.ts`의 `curationItems` 테이블 정의에 2개 컬럼과 1개 인덱스를 추가한다:

```typescript
export const curationItems = pgTable(
  'curation_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').references(() => curationSources.id),
    title: varchar('title', { length: 500 }).notNull(),
    url: varchar('url', { length: 1000 }).notNull().unique(),
    description: text('description'),                              // NEW
    thumbnailUrl: varchar('thumbnail_url', { length: 1000 }),      // NEW
    publishedAt: timestamp('published_at', { withTimezone: true }),
    category: varchar('category', { length: 50 }).notNull(),
    tags: text('tags').array(),
    relevanceScore: real('relevance_score').default(0),
    isShared: boolean('is_shared').default(false),
    sharedAt: timestamp('shared_at', { withTimezone: true }),
    collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    isSharedIdx: index('idx_curation_items_is_shared').on(table.isShared),
    publishedAtIdx: index('idx_curation_items_published_at').on(table.publishedAt),  // NEW
  })
);
```

**Step 2: DB 마이그레이션 push**

```bash
cd packages/shared
export $(grep DATABASE_URL ../../.env.local | head -1 | xargs)
npx drizzle-kit push --force
```

Expected: 테이블에 `description`, `thumbnail_url` 컬럼 추가 + `idx_curation_items_published_at` 인덱스 생성

**Step 3: shared 패키지 리빌드**

```bash
pnpm --filter @blog-study/shared build
```

**Step 4: 커밋**

```bash
git add packages/shared/src/db/schema.ts
git commit -m "feat: curationItems에 description, thumbnailUrl 컬럼 및 publishedAt 인덱스 추가"
```

---

## Task 2: 크롤링 — RSS description 저장 + og:image 추출

**Files:**
- Modify: `packages/web/src/app/api/admin/curation/crawl/route.ts:22-63,165-201`

**주의:** 크롤링 로직은 `packages/bot/src/services/`와 `packages/web/src/app/api/admin/curation/crawl/route.ts` 두 곳에 있다. 웹 관리자 크롤링(`crawl/route.ts`)이 실제로 사용되는 메인 크롤링이므로 여기를 변경한다.

**Step 1: NormalizedFeedItem에 description 필드 추가**

`crawl/route.ts`의 `NormalizedFeedItem` 인터페이스에 `description` 필드를 추가하고, `extractFeedItems` 함수에서 description을 추출한다:

```typescript
interface NormalizedFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;   // NEW
  categories?: string[];
}
```

`extractFeedItems` 함수의 각 format에서 description을 매핑:
- atom: `entry.summary ?? entry.content`
- rss: `item.description`
- json: `item.summary ?? item.content_text`
- rdf: `item.description`

**Step 2: og:image 추출 헬퍼 함수 추가**

`crawl/route.ts` 상단에 og:image 추출 함수를 추가:

```typescript
/**
 * URL에서 og:image 메타태그 추출
 * HTML 상단만 파싱, 5초 타임아웃
 */
async function extractOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const html = await response.text();
    // og:image 메타태그 정규식 추출 (cheerio 없이 가볍게)
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
```

**Step 3: HTML 태그 제거 + 300자 truncate 헬퍼**

```typescript
/**
 * HTML 태그 제거 + 300자 truncate
 */
function sanitizeDescription(html: string | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, '')           // HTML 태그 제거
    .replace(/&[a-zA-Z]+;/g, ' ')      // HTML 엔티티 제거
    .replace(/\s+/g, ' ')              // 다중 공백 정리
    .trim();
  if (!text) return null;
  return text.length > 300 ? text.slice(0, 300) + '...' : text;
}
```

**Step 4: 크롤링 루프에서 description/thumbnailUrl 저장**

`crawl/route.ts`의 아이템 저장 부분(기존 `database.insert(curationItems).values({...})`)을 변경:

```typescript
// description 정제
const description = sanitizeDescription(item.description);

// og:image 추출 (새 아이템만)
const thumbnailUrl = await extractOgImage(item.link);

await database.insert(curationItems).values({
  sourceId: source.id,
  title: item.title,
  url: item.link,
  description,          // NEW
  thumbnailUrl,         // NEW
  publishedAt,
  category: source.category,
  tags: mergedTags.length > 0 ? mergedTags : null,
  relevanceScore: 0,
  isShared: false,
});
```

**Step 5: 커밋**

```bash
git add packages/web/src/app/api/admin/curation/crawl/route.ts
git commit -m "feat: 크롤링 시 RSS description 저장 + og:image 추출"
```

---

## Task 3: API — cursor 기반 페이지네이션으로 변경

**Files:**
- Modify: `packages/web/src/app/api/curation/route.ts`

**Step 1: GET 핸들러를 cursor 기반으로 전면 리팩터링**

기존 offset 기반 페이지네이션을 cursor 기반으로 변경하고, description/thumbnailUrl을 응답에 포함:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { desc, count, eq, and, sql, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { successResponse, errorResponse } from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';

const { curationItems, curationSources } = sharedDb;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const tagsParam = searchParams.get('tags') || '';
    const cursor = searchParams.get('cursor'); // ISO timestamp or null
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));

    const database = db();

    // Build conditions
    const conditions = [];
    if (category !== 'all') {
      conditions.push(eq(curationItems.category, category));
    }

    // Tag AND-filter
    const selectedTags = tagsParam
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4);

    if (selectedTags.length > 0) {
      conditions.push(
        sql`${curationItems.tags} @> ARRAY[${sql.join(
          selectedTags.map((t) => sql`${t}`),
          sql`,`
        )}]::text[]`
      );
    }

    // Cursor: publishedAt < cursor (이전 페이지의 마지막 아이템)
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        conditions.push(lt(curationItems.publishedAt, cursorDate));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // cursor 없는 기본 조건(필터만)으로 totalCount
    const countConditions = [];
    if (category !== 'all') {
      countConditions.push(eq(curationItems.category, category));
    }
    if (selectedTags.length > 0) {
      countConditions.push(
        sql`${curationItems.tags} @> ARRAY[${sql.join(
          selectedTags.map((t) => sql`${t}`),
          sql`,`
        )}]::text[]`
      );
    }
    const countWhere = countConditions.length > 0 ? and(...countConditions) : undefined;
    const totalCountResult = await database
      .select({ count: count() })
      .from(curationItems)
      .where(countWhere);
    const totalCount = totalCountResult[0]?.count ?? 0;

    // Fetch items: limit+1로 hasMore 판단
    const itemsResult = await database
      .select({
        id: curationItems.id,
        title: curationItems.title,
        url: curationItems.url,
        description: curationItems.description,
        thumbnailUrl: curationItems.thumbnailUrl,
        publishedAt: curationItems.publishedAt,
        category: curationItems.category,
        tags: curationItems.tags,
        relevanceScore: curationItems.relevanceScore,
        isShared: curationItems.isShared,
        sharedAt: curationItems.sharedAt,
        sourceName: curationSources.name,
      })
      .from(curationItems)
      .leftJoin(curationSources, eq(curationItems.sourceId, curationSources.id))
      .where(whereClause)
      .orderBy(desc(curationItems.publishedAt), desc(curationItems.collectedAt))
      .limit(limit + 1);

    const hasMore = itemsResult.length > limit;
    const items = hasMore ? itemsResult.slice(0, limit) : itemsResult;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem?.publishedAt
      ? lastItem.publishedAt.toISOString()
      : null;

    return successResponse({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        description: item.description ?? null,
        thumbnailUrl: item.thumbnailUrl ?? null,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        category: item.category,
        tags: item.tags,
        relevanceScore: item.relevanceScore,
        sharedAt: item.isShared ? item.sharedAt?.toISOString() : null,
        sourceName: item.sourceName ?? null,
      })),
      nextCursor,
      hasMore,
      totalCount,
    });
  } catch (error) {
    console.error('Curation API error:', error);
    return errorResponse(error);
  }
}
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/api/curation/route.ts
git commit -m "feat: 큐레이션 API cursor 기반 페이지네이션 + description/thumbnailUrl 반환"
```

---

## Task 4: 유틸리티 — 그라디언트 플레이스홀더 + scrollbar-hide CSS

**Files:**
- Create: `packages/web/src/lib/curation-utils.ts`
- Modify: `packages/web/src/app/globals.css` (scrollbar-hide 유틸리티 추가)

**Step 1: curation-utils.ts 생성**

```typescript
/**
 * 큐레이션 UI 유틸리티
 */

const GRADIENTS = [
  'from-sky-100 to-sky-200 dark:from-sky-900/30 dark:to-sky-800/30',
  'from-violet-100 to-violet-200 dark:from-violet-900/30 dark:to-violet-800/30',
  'from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30',
  'from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30',
  'from-rose-100 to-rose-200 dark:from-rose-900/30 dark:to-rose-800/30',
  'from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/30',
] as const;

/**
 * 소스명/제목 기반 결정적 그라디언트 반환
 * 썸네일이 없을 때 플레이스홀더로 사용
 */
export function getArticleGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]!;
}

/**
 * 상대 시간 포맷 (한국어)
 */
export function formatRelativeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/**
 * 카테고리 스타일 상수
 */
export const CATEGORY_STYLES: Record<string, { label: string; emoji: string; bg: string; text: string; ring: string }> = {
  conference: {
    label: '컨퍼런스',
    emoji: '🎤',
    bg: 'bg-violet-100 dark:bg-violet-500/20',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200 dark:ring-violet-500/30',
  },
  article: {
    label: '아티클',
    emoji: '📝',
    bg: 'bg-sky-100 dark:bg-sky-500/20',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200 dark:ring-sky-500/30',
  },
};
```

**Step 2: globals.css에 scrollbar-hide 유틸리티 추가**

`packages/web/src/app/globals.css`에 추가:

```css
/* Scrollbar hide utility */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

**Step 3: 커밋**

```bash
git add packages/web/src/lib/curation-utils.ts packages/web/src/app/globals.css
git commit -m "feat: 큐레이션 유틸리티 (그라디언트 플레이스홀더, 상대시간, scrollbar-hide)"
```

---

## Task 5: 프론트엔드 — 큐레이션 페이지 전면 리디자인

**Files:**
- Modify: `packages/web/src/app/(user)/curation/page.tsx` (전면 교체)

이 태스크가 가장 크다. 기존 `page.tsx`를 전면 교체한다.

**주요 변경점:**
1. 페이지네이션 → 무한스크롤 (IntersectionObserver)
2. 그리드 카드 → 반응형 (모바일 카드 / PC 리스트)
3. 필터를 useState → URL searchParams 동기화
4. sticky 필터바
5. 썸네일 + description 표시
6. 스켈레톤/빈/끝 상태

**Step 1: page.tsx 전면 교체**

```tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ExternalLink, Calendar, Sparkles, X, Loader2 } from 'lucide-react';
import { INTEREST_OPTIONS } from '@blog-study/shared/config';
import { Badge } from '@/components/ui/badge';
import { PageError } from '@/components/ui/page-state';
import {
  getArticleGradient,
  formatRelativeDate,
  CATEGORY_STYLES,
} from '@/lib/curation-utils';

// ─── Types ────────────────────────────────────────

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

const FILTERS: { value: FilterValue; label: string; emoji: string }[] = [
  { value: 'all', label: '전체', emoji: '📚' },
  { value: 'conference', label: '컨퍼런스', emoji: '🎤' },
  { value: 'article', label: '아티클', emoji: '📝' },
];

const MAX_TAGS = 4;

// ─── Thumbnail Component ──────────────────────────

function Thumbnail({
  url,
  title,
  category,
  className,
}: {
  url: string | null;
  title: string;
  category: string;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const catStyle = CATEGORY_STYLES[category] ?? CATEGORY_STYLES['article']!;

  if (!url || error) {
    const gradient = getArticleGradient(title);
    return (
      <div
        className={`bg-gradient-to-br ${gradient} flex items-center justify-center ${className}`}
      >
        <span className="text-2xl opacity-40">{catStyle.emoji}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={`object-cover ${className}`}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}

// ─── Card View (Mobile/Tablet) ────────────────────

function CurationCard({ item }: { item: CurationItem }) {
  const catStyle = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES['article']!;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border/60 overflow-hidden
        hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5
        transition-all duration-200 bg-card"
    >
      {/* Thumbnail */}
      <Thumbnail
        url={item.thumbnailUrl}
        title={item.title}
        category={item.category}
        className="w-full aspect-video"
      />

      {/* Content */}
      <div className="p-4 space-y-1.5">
        {/* Category + Shared badges */}
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${catStyle.bg} ${catStyle.text} ${catStyle.ring}`}
          >
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
        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-3 mt-1.5">
            {item.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {item.sourceName && (
              <span className="font-medium">{item.sourceName}</span>
            )}
            {item.sourceName && item.publishedAt && <span>·</span>}
            {item.publishedAt && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatRelativeDate(item.publishedAt)}</span>
              </div>
            )}
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </a>
  );
}

// ─── List View (PC) ───────────────────────────────

function CurationListRow({ item }: { item: CurationItem }) {
  const catStyle = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES['article']!;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
    >
      {/* Thumbnail */}
      <Thumbnail
        url={item.thumbnailUrl}
        title={item.title}
        category={item.category}
        className="w-[100px] h-[64px] rounded-md shrink-0"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${catStyle.bg} ${catStyle.text} ${catStyle.ring}`}
          >
            {catStyle.label}
          </span>
          {item.sourceName && (
            <>
              <span>·</span>
              <span className="font-medium">{item.sourceName}</span>
            </>
          )}
          {item.publishedAt && (
            <>
              <span>·</span>
              <span>{formatRelativeDate(item.publishedAt)}</span>
            </>
          )}
          {item.sharedAt && (
            <>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <Sparkles className="h-3 w-3" />
                공유됨
              </span>
            </>
          )}
        </div>
      </div>

      <ExternalLink className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 self-center" />
    </a>
  );
}

// ─── Skeletons ────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden animate-pulse">
      <div className="w-full aspect-video bg-muted" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-muted rounded w-16" />
        <div className="space-y-1.5">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-4/5" />
        </div>
        <div className="space-y-1">
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-3/4" />
        </div>
        <div className="flex justify-between pt-1">
          <div className="h-3 bg-muted rounded w-28" />
          <div className="h-3 bg-muted rounded w-4" />
        </div>
      </div>
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className="flex gap-4 px-4 py-3 animate-pulse">
      <div className="w-[100px] h-[64px] bg-muted rounded-md shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────

export default function CurationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // URL params → state
  const filter = (searchParams.get('category') as FilterValue) ?? 'all';
  const selectedTags = searchParams.get('tags')?.split(',').filter(Boolean) ?? [];

  // Infinite scroll state
  const [items, setItems] = useState<CurationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  // ── Fetch ─────────────────────────────────────

  const fetchItems = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          category: filter,
          limit: '12',
        });
        if (selectedTags.length > 0) {
          params.set('tags', selectedTags.join(','));
        }
        if (cursor) {
          params.set('cursor', cursor);
        }

        const response = await fetch(`/api/curation?${params}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const result = await response.json();
        const data: CurationData = result.data;

        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
        setTotalCount(data.totalCount);
      } catch {
        setError('큐레이션 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, selectedTags]
  );

  // ── Initial fetch on filter change ────────────

  useEffect(() => {
    isFirstLoad.current = true;
    setItems([]);
    setNextCursor(null);
    setHasMore(true);
    fetchItems(null, false);
  }, [fetchItems]);

  // ── IntersectionObserver for infinite scroll ──

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchItems(nextCursor, true);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, nextCursor, fetchItems]);

  // ── Filter handlers (URL sync) ────────────────

  const updateFilters = useCallback(
    (newCategory: FilterValue, newTags: string[]) => {
      const params = new URLSearchParams();
      if (newCategory !== 'all') params.set('category', newCategory);
      if (newTags.length > 0) params.set('tags', newTags.join(','));
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, pathname]
  );

  const handleFilterChange = (value: FilterValue) => {
    updateFilters(value, selectedTags);
  };

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : selectedTags.length >= MAX_TAGS
        ? selectedTags
        : [...selectedTags, tag];
    updateFilters(filter, newTags);
  };

  const clearTags = () => {
    updateFilters(filter, []);
  };

  // ── Error state ───────────────────────────────

  if (error && items.length === 0) {
    return <PageError message={error} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="space-y-1 mb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Curation
        </p>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <h1 className="text-xl font-semibold text-foreground">큐레이션</h1>
          <span className="text-sm text-muted-foreground">
            {totalCount}개의 콘텐츠
          </span>
        </div>
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/60 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 space-y-2.5">
        {/* Category Pills */}
        <div className="flex gap-2">
          {FILTERS.map(({ value, label, emoji }) => (
            <button
              key={value}
              onClick={() => handleFilterChange(value)}
              className={`
                inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium
                transition-all duration-200 shrink-0
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

        {/* Tag Chips */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 sm:flex-wrap sm:overflow-visible">
            {INTEREST_OPTIONS.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className={`shrink-0 whitespace-nowrap cursor-pointer transition-colors text-xs ${
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
          {selectedTags.length > 0 && (
            <button
              onClick={clearTags}
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="h-3 w-3" />
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-4">
        {/* Initial Loading */}
        {loading ? (
          <>
            {/* Card skeletons (mobile/tablet) */}
            <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            {/* List skeletons (PC) */}
            <div className="hidden lg:block rounded-xl border border-border/60 divide-y divide-border/40">
              {Array.from({ length: 8 }).map((_, i) => (
                <ListRowSkeleton key={i} />
              ))}
            </div>
          </>
        ) : items.length > 0 ? (
          <>
            {/* Card grid (mobile/tablet) */}
            <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
              {items.map((item) => (
                <CurationCard key={item.id} item={item} />
              ))}
            </div>

            {/* List feed (PC) */}
            <div className="hidden lg:block rounded-xl border border-border/60 divide-y divide-border/40">
              {items.map((item) => (
                <CurationListRow key={item.id} item={item} />
              ))}
            </div>

            {/* Loading more */}
            {loadingMore && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:hidden mt-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <CardSkeleton key={`more-${i}`} />
                  ))}
                </div>
                <div className="hidden lg:block divide-y divide-border/40 mt-0">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ListRowSkeleton key={`more-${i}`} />
                  ))}
                </div>
              </>
            )}

            {/* Sentinel for IntersectionObserver */}
            <div ref={sentinelRef} className="h-px" aria-hidden="true" />

            {/* End of feed */}
            {!hasMore && items.length > 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="h-px w-16 bg-border/60 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  {totalCount}개 모두 확인했어요
                </p>
                <p className="text-xs text-muted-foreground/60">
                  새 콘텐츠는 매일 업데이트됩니다
                </p>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-5xl">
              {selectedTags.length > 0 ? '🔍' : '📭'}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedTags.length > 0
                ? '선택한 조건에 맞는 콘텐츠가 없어요'
                : '아직 큐레이션된 콘텐츠가 없어요'}
            </p>
            {selectedTags.length > 0 && (
              <button
                onClick={clearTags}
                className="text-xs text-primary hover:underline"
              >
                필터 초기화
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: 빌드 확인**

```bash
pnpm --filter @blog-study/web build
```

Expected: 빌드 성공

**Step 3: 커밋**

```bash
git add packages/web/src/app/(user)/curation/page.tsx
git commit -m "feat: 큐레이션 페이지 무한스크롤 + 반응형 레이아웃 리디자인"
```

---

## Task 6: 통합 테스트 및 검증

**Step 1: shared 리빌드 + 웹 빌드 확인**

```bash
pnpm --filter @blog-study/shared build && pnpm --filter @blog-study/web build
```

**Step 2: 로컬에서 수동 검증**

```bash
pnpm dev:web
```

검증 항목:
1. `/curation` 접속 → 최신순 무한스크롤 확인
2. 모바일(DevTools 360px) → 1컬럼 카드 피드 + 썸네일 or 그라디언트
3. 태블릿(768px) → 2컬럼 그리드
4. PC(1280px) → 리스트 피드
5. 카테고리 필터 → URL params 변경 + 결과 갱신
6. 태그 필터 → AND 필터 동작 + 모바일에서 가로 스크롤
7. 스크롤 끝 도달 → 자동 추가 로딩
8. 모든 아이템 로딩 → "N개 모두 확인했어요" 표시
9. sticky 필터바 → 스크롤 시 상단 고정

**Step 3: 관리자 크롤링으로 기존 데이터 backfill**

관리자 대시보드 → 크롤링 실행 → 기존 소스 재크롤링
→ 새 아이템에 description + thumbnailUrl 저장 확인

**Step 4: 최종 커밋 (필요시)**

```bash
git add -p  # 수정 사항만 선택적으로
git commit -m "fix: 큐레이션 리디자인 통합 테스트 후 수정"
```
