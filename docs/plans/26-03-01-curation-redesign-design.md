# Curation UX/UI Redesign Design

## 목표

큐레이션 페이지를 모바일 무한스크롤 피드 + PC 리스트 피드로 개선하고,
RSS에서 본문 미리보기(description)와 썸네일(og:image)을 추출/저장하여 콘텐츠 탐색 경험을 향상시킨다.

## 결정 사항

| 항목 | 결정 |
|------|------|
| 모바일 레이아웃 | 1컬럼 무한스크롤 카드 피드 (제목 + 3-4줄 요약 + 16:9 썸네일) |
| 태블릿 레이아웃 | 2컬럼 그리드 |
| PC 레이아웃 | 리스트 피드 (좌측 100x64 썸네일 + 우측 제목/요약) |
| 글 진입 | 클릭 시 외부 원문 링크 새 탭 |
| 필터 | sticky 필터바 (카테고리 탭 + 태그 칩 가로 스크롤) |
| 정렬 | 최신순 (publishedAt DESC) |
| 페이지네이션 | cursor 기반 무한스크롤 |
| 데이터 | RSS description 300자 + og:image 크롤링 저장 |

---

## 1. 데이터 레이어

### DB 스키마 변경

`curationItems` 테이블에 컬럼 추가:

```sql
ALTER TABLE curation_items ADD COLUMN description TEXT;
ALTER TABLE curation_items ADD COLUMN thumbnail_url VARCHAR(1000);
ALTER TABLE curation_items ADD INDEX idx_curation_items_published_at ON published_at;
```

Drizzle 스키마:

```typescript
// curationItems에 추가
description: text('description'),
thumbnailUrl: varchar('thumbnail_url', { length: 1000 }),

// 인덱스 추가
publishedAtIdx: index('idx_curation_items_published_at').on(table.publishedAt),
```

### RSS 크롤링 파이프라인 변경

```
[RSS Feed] → feedsmith 파싱
  ├─ title, link, pubDate → 기존 그대로
  ├─ description → HTML 태그 제거 → 300자 truncate → DB 저장 (NEW)
  └─ link → fetch(link) → <meta property="og:image"> → thumbnailUrl (NEW)
```

- og:image 추출: 글당 HTTP GET 1회, 타임아웃 5초
- 실패 시 thumbnailUrl = null (UI에서 그라디언트 플레이스홀더)
- 기존 아이템: 관리자 재크롤링으로 backfill

---

## 2. API 변경

### GET /api/curation — cursor 기반 페이지네이션

**Request:**

```
GET /api/curation?category=all&tags=프론트엔드,AI&cursor=2025-12-01T10:30:00Z&limit=12
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| category | string | all / conference / article |
| tags | string | 쉼표 구분, AND 필터 (최대 4개) |
| cursor | string? | 마지막 아이템의 publishedAt ISO 문자열 |
| limit | number | 1~50, 기본 12 |

**Response:**

```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "React 19의 새로운 훅 패턴",
        "url": "https://...",
        "description": "React 19에서 도입된 use() 훅은...",
        "thumbnailUrl": "https://og-image.../react19.png",
        "publishedAt": "2025-12-01T10:30:00Z",
        "category": "article",
        "tags": ["프론트엔드", "AI"],
        "sourceName": "tech-blog"
      }
    ],
    "nextCursor": "2025-11-28T09:00:00Z",
    "hasMore": true,
    "totalCount": 142
  }
}
```

- 정렬: `publishedAt DESC` (최신순)
- cursor가 null이면 첫 페이지
- nextCursor가 null이면 마지막 페이지
- 필터 변경 시 cursor 리셋

---

## 3. 모바일 UI — 무한스크롤 카드 피드 (< sm: 1컬럼)

```
┌──────────────────────────────────┐
│  [  16:9 썸네일 or 그라디언트  ] │  aspect-video, rounded-t-xl
│──────────────────────────────────│
│  🏷 아티클                       │  카테고리 배지, mt-3
│                                  │
│  React 19의 새로운 훅 패턴과     │  text-sm font-medium
│  서버 컴포넌트 통합 가이드       │  line-clamp-2, leading-snug
│                                  │
│  React 19에서 도입된 use() 훅은  │  text-xs text-muted-foreground
│  기존 useEffect의 한계를 극복    │  line-clamp-3, mt-1.5
│  하고 서버 컴포넌트와의 통합...  │
│                                  │
│  📌 tech-blog · 2일 전      ↗   │  footer, mt-2
└──────────────────────────────────┘
```

### 카드 스펙

| 요소 | 스펙 |
|------|------|
| 카드 패딩 | p-4 (컨텐츠 영역), 썸네일은 edge-to-edge |
| 카드 간격 | gap-3 (12px) |
| 썸네일 | aspect-video (16:9), object-cover, rounded-t-xl |
| 제목 | text-sm font-medium line-clamp-2 leading-snug |
| 요약 | text-xs text-muted-foreground line-clamp-3 |
| 푸터 | text-xs, source · 상대시간 · ExternalLink 아이콘 |

### 썸네일 없을 때 — 그라디언트 플레이스홀더

소스명/제목 해시 기반으로 결정적 그라디언트 + 카테고리 이모지:

```typescript
const GRADIENTS = [
  'from-sky-100 to-sky-200 dark:from-sky-900/30 dark:to-sky-800/30',
  'from-violet-100 to-violet-200 dark:from-violet-900/30 dark:to-violet-800/30',
  'from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30',
  'from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30',
  'from-rose-100 to-rose-200 dark:from-rose-900/30 dark:to-rose-800/30',
];

function getArticleGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]!;
}
```

### 반응형 브레이크포인트

| 뷰포트 | 레이아웃 |
|--------|---------|
| `< sm` (< 640px) | 1컬럼 카드 피드 |
| `sm ~ lg` (640~1023px) | 2컬럼 카드 그리드 |
| `≥ lg` (1024px+) | 리스트 피드 |

---

## 4. PC UI — 리스트 피드 (≥ lg)

```
┌───────────────────────────────────────────────────────────────┐
│ [100×64px ] React 19의 새로운 훅 패턴과 서버 컴포넌트        │
│ [썸네일   ] 통합 가이드                                       │
│ [        ]                                                    │
│            React 19에서 도입된 use() 훅은 기존 useEffect의   │
│            한계를 극복하고 서버 컴포넌트와의 통합을...        │
│            아티클 · tech-blog · 2일 전                    ↗  │
├───────────────────────────────────────────────────────────────┤
│ [100×64px ] Next.js 16 App Router 완전 정복                  │
│ ...                                                           │
└───────────────────────────────────────────────────────────────┘
```

### 리스트 행 스펙

| 요소 | 스펙 |
|------|------|
| 행 패딩 | px-4 py-3 |
| 행 구분 | divide-y divide-border/40 |
| 썸네일 | w-[100px] h-[64px] rounded-md object-cover shrink-0 |
| 제목 | text-sm font-medium line-clamp-2 leading-snug |
| 요약 | text-xs text-muted-foreground line-clamp-2 (카드보다 1줄 적음) |
| 푸터 | 카테고리 배지 · source · 상대시간 · ↗ |
| hover | hover:bg-muted/40 |
| 행 높이 | 80~100px (뷰포트당 8~10개 표시) |

---

## 5. Sticky 필터바

```
┌──────────────────────────────────────────┐
│ [📚 전체] [🎤 컨퍼런스] [📝 아티클]     │  카테고리 탭
│ [프론트엔드][백엔드][AI][LLM]→ 스크롤    │  태그 칩
├────── sticky top-14 z-20 ────────────────┤
│                                          │
│  피드 콘텐츠 영역                         │
```

### 필터바 스펙

```tsx
<div className="sticky top-14 z-20 bg-background/95 backdrop-blur-sm
  border-b border-border/60 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3">
```

- 카테고리 탭: 기존 pill 버튼 유지 (bg-foreground text-background 활성 상태)
- 태그 칩 (모바일): `overflow-x-auto scrollbar-hide` 가로 스크롤, `shrink-0 whitespace-nowrap`
- 태그 칩 (PC): `flex-wrap` 줄바꿈
- **필터 상태 → URL searchParams 동기화** (useSearchParams + router.push)
- 필터 변경 시 `{ scroll: false }` 옵션으로 스크롤 위치 유지

---

## 6. 로딩/빈/끝 상태

### 초기 로딩

썸네일 블록 포함 스켈레톤 카드 6개 (카드 모드) 또는 스켈레톤 행 8개 (리스트 모드)

### 추가 로딩 (무한스크롤)

기존 콘텐츠 유지 + 하단에 스켈레톤 3개 append

### IntersectionObserver

피드 끝에서 **400px 위**에 센티넬 배치 (프리로드, 끊김 없는 스크롤)

### 끝 표시

```
─────────────
142개 모두 확인했어요
새 콘텐츠는 매일 업데이트됩니다
```

### 빈 상태

| 상황 | 표시 |
|------|------|
| 필터 결과 없음 | 🔍 선택한 조건에 맞는 콘텐츠가 없어요 + [필터 초기화] |
| 전체 비어있음 | 📭 아직 큐레이션된 콘텐츠가 없어요 |

---

## 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `packages/shared/src/db/schema.ts` | curationItems에 description, thumbnailUrl 컬럼 + 인덱스 추가 |
| `packages/bot/src/services/rss.service.ts` | og:image 추출 함수 추가 |
| `packages/bot/src/services/curation.service.ts` | 크롤링 시 description/thumbnailUrl 저장 |
| `packages/web/src/app/api/curation/route.ts` | cursor 기반 페이지네이션 + description/thumbnailUrl 반환 |
| `packages/web/src/app/(user)/curation/page.tsx` | 전면 리디자인 (무한스크롤 + 반응형 레이아웃) |
| `packages/web/src/lib/curation-utils.ts` | getArticleGradient 유틸 (NEW) |
