# UI 디자인 시스템

## 디자인 방향

**컨셉**: Vercel 화이트/블랙 미니멀 + 스카이블루 포인트
- 해외 어드민 사이트 느낌: 깔끔, 세련, 여백 활용
- 참고: hazel-admin (레이아웃/컴포넌트), obsidian-quartz-blog (타이포/색상 체계)

---

## 컬러 시스템

### Light Mode

| 토큰 | 색상 | 용도 |
|------|------|------|
| `--background` | `#ffffff` | 페이지 배경 |
| `--foreground` | `#18181b` (zinc-900) | 기본 텍스트 |
| `--muted` | `#f4f4f5` (zinc-100) | 비활성 배경, 카드 배경 |
| `--muted-foreground` | `#71717a` (zinc-500) | 보조 텍스트, 플레이스홀더 |
| `--border` | `#e4e4e7` (zinc-200) | 테두리, 구분선 |
| `--primary` | `#0ea5e9` (sky-500) | 주요 액션, 링크, 포인트 |
| `--primary-hover` | `#0284c7` (sky-600) | 호버 상태 |
| `--primary-foreground` | `#ffffff` | primary 위 텍스트 |
| `--primary-muted` | `#e0f2fe` (sky-100) | 포인트 배경, 뱃지 |
| `--secondary` | `#f4f4f5` (zinc-100) | 보조 버튼 배경 |
| `--secondary-foreground` | `#18181b` | 보조 버튼 텍스트 |
| `--destructive` | `#ef4444` (red-500) | 삭제, 에러 |
| `--success` | `#22c55e` (green-500) | 성공, 출석 |
| `--warning` | `#f59e0b` (amber-500) | 경고, 지각 |
| `--accent` | `#f4f4f5` | 사이드바 호버 |
| `--ring` | `#0ea5e9` | 포커스 링 |

### Dark Mode

| 토큰 | 색상 |
|------|------|
| `--background` | `#09090b` (zinc-950) |
| `--foreground` | `#fafafa` (zinc-50) |
| `--muted` | `#27272a` (zinc-800) |
| `--muted-foreground` | `#a1a1aa` (zinc-400) |
| `--border` | `#3f3f46` (zinc-700) |
| `--primary` | `#38bdf8` (sky-400) |
| `--primary-hover` | `#0ea5e9` (sky-500) |
| `--primary-muted` | `#0c4a6e` (sky-900) |
| `--secondary` | `#27272a` (zinc-800) |

### 차트 컬러

```
--chart-1: #0ea5e9  (sky - 출석/제출)
--chart-2: #22c55e  (green - 성공)
--chart-3: #f59e0b  (amber - 지각)
--chart-4: #ef4444  (red - 결석)
--chart-5: #8b5cf6  (violet - 기타)
```

---

## 타이포그래피

### 폰트

```css
--font-sans: "Pretendard Variable", "Pretendard",
  -apple-system, BlinkMacSystemFont, system-ui, Roboto,
  "Helvetica Neue", "Segoe UI", sans-serif;

--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular,
  Menlo, Monaco, Consolas, monospace;
```

**Pretendard 로딩**: CDN (`cdn.jsdelivr.net/gh/orioncactus/pretendard`)

### 크기 스케일

| 용도 | 크기 | 무게 | 행간 |
|------|------|------|------|
| h1 (페이지 제목) | `clamp(1.65rem, 1.4rem + 1vw, 2rem)` | 700 | 1.2 |
| h2 (섹션 제목) | `clamp(1.35rem, 1.2rem + 0.6vw, 1.5rem)` | 600 | 1.3 |
| h3 (서브섹션) | `clamp(1.1rem, 1rem + 0.4vw, 1.25rem)` | 600 | 1.4 |
| body | `0.875rem` (14px) | 400 | 1.6 |
| small/label | `0.75rem` (12px) | 500 | 1.4 |
| code | `0.85rem` | 400 | 1.5 |

### 자간

```css
body { letter-spacing: -0.014em; }
h1, h2, h3 { letter-spacing: -0.025em; }
```

---

## 디자인 토큰

### 간격 (Spacing)

```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 1rem;       /* 16px */
--spacing-lg: 1.5rem;    /* 24px */
--spacing-xl: 2rem;       /* 32px */
--spacing-2xl: 3rem;     /* 48px */
```

### 라운딩 (Border Radius)

```css
--radius: 0.75rem;        /* 12px - 기본 */
--radius-sm: 0.5rem;      /* 8px - 뱃지, 인라인 코드 */
--radius-md: 0.625rem;    /* 10px */
--radius-lg: 0.75rem;     /* 12px - 카드 */
--radius-xl: 1rem;        /* 16px - 모달 */
--radius-full: 9999px;    /* 원형 - 아바타 */
```

### 그림자 (Shadow)

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07),
             0 2px 4px -2px rgba(0, 0, 0, 0.05);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08),
             0 4px 6px -4px rgba(0, 0, 0, 0.04);
```

### 트랜지션

```css
--transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

---

## 레이아웃

### 데스크톱 (≥1024px)

```
┌──────────────────────────────────────────────────────────┐
│  Sidebar (240px)  │  Main Content (max-w-7xl, mx-auto)  │
│                   │                                       │
│  ┌─────────────┐  │  ┌─ Header (sticky) ──────────────┐  │
│  │ Logo        │  │  │ 페이지 제목     [🔔] [🌙] [👤] │  │
│  │             │  │  └────────────────────────────────┘  │
│  │ ─────────── │  │                                       │
│  │ 대시보드     │  │  ┌─ Content ──────────────────────┐  │
│  │ 글 목록      │  │  │                                │  │
│  │ 랭킹        │  │  │  p-4 sm:p-6 lg:p-8             │  │
│  │ 큐레이션     │  │  │                                │  │
│  │             │  │  └────────────────────────────────┘  │
│  │ ─────────── │  │                                       │
│  │ 관리자      │  │                                       │
│  │  멤버       │  │                                       │
│  │  출석       │  │                                       │
│  │  벌금       │  │                                       │
│  │  설정       │  │                                       │
│  │             │  │                                       │
│  │ ─────────── │  │                                       │
│  │ [👤 유저]   │  │                                       │
│  └─────────────┘  │                                       │
└──────────────────────────────────────────────────────────┘
```

### 모바일 (<1024px)

- 사이드바 → 햄버거 메뉴 (오버레이 드로어)
- 컨텐츠 전체 너비
- 반응형 패딩: `p-4`

### 사이드바 기능

- 접기/펼치기 (아이콘만 모드)
- localStorage로 상태 유지
- 활성 메뉴: 좌측 스카이블루 바 인디케이터
- 접힌 상태: 아이콘 + 툴팁

---

## 컴포넌트 패턴

### 버튼 Variants

| Variant | 배경 | 텍스트 | 용도 |
|---------|------|--------|------|
| `default` | zinc-900 | white | 주요 액션 |
| `primary` | sky-500 | white | 포인트 액션 (참가, 저장) |
| `secondary` | zinc-100 | zinc-900 | 보조 액션 |
| `outline` | transparent + border | zinc-900 | 3차 액션 |
| `ghost` | transparent | zinc-900 | 사이드바, 아이콘 |
| `destructive` | red-500 | white | 삭제, 위험 액션 |
| `link` | transparent | sky-500 | 텍스트 링크 |

**크기**: `sm` (h-8), `default` (h-9), `lg` (h-10), `icon` (h-9 w-9)

### 카드

```
┌─ Card ──────────────────────────────┐
│ ┌─ CardHeader ──────────────────┐   │
│ │ CardTitle        CardAction   │   │
│ │ CardDescription              │   │
│ └──────────────────────────────┘   │
│ ┌─ CardContent ─────────────────┐   │
│ │                               │   │
│ └──────────────────────────────┘   │
│ ┌─ CardFooter ──────────────────┐   │
│ │                               │   │
│ └──────────────────────────────┘   │
└────────────────────────────────────┘
```

- 패딩: `px-6`
- 라운딩: `rounded-lg` (12px)
- 호버: `translateY(-2px)` + 그림자 증가

### 데이터 테이블

- shadcn/ui Table 컴포넌트
- 정렬, 필터, 페이지네이션
- 모바일: 수직 레이아웃 전환

### 상태 뱃지

| 상태 | 색상 | 텍스트 |
|------|------|--------|
| 출석(submitted) | green-100/green-800 | 제출 완료 |
| 미제출(pending) | zinc-100/zinc-600 | 미제출 |
| 지각(late) | amber-100/amber-800 | 지각 |
| 결석(absent) | red-100/red-800 | 결석 |
| 활성(active) | sky-100/sky-800 | 활성 |
| 휴면(dormant) | zinc-100/zinc-600 | 휴면 |
| 탈퇴(withdrawn) | zinc-50/zinc-400 | 탈퇴 |

---

## 아이콘

**lucide-react** 사용. 주요 아이콘:

| 메뉴 | 아이콘 |
|------|--------|
| 대시보드 | `LayoutDashboard` |
| 글 목록 | `FileText` |
| 랭킹 | `Trophy` |
| 큐레이션 | `Newspaper` |
| 멤버 관리 | `Users` |
| 출석 | `CalendarCheck` |
| 벌금 | `Banknote` |
| 설정 | `Settings` |
| 알림 | `Bell` |
| 다크모드 | `Moon` / `Sun` |
| 프로필 | `User` |

---

## 다크모드

- `next-themes` 사용
- `attribute="class"` (html에 `dark` 클래스 추가)
- `defaultTheme="system"` (시스템 설정 따름)
- CSS 변수 기반 전환 (트랜지션 없음 - `disableTransitionOnChange`)

---

## 반응형 브레이크포인트

| 이름 | 너비 | 변경 |
|------|------|------|
| mobile | < 768px | 1열, 사이드바 숨김 |
| tablet | 768px - 1023px | 1열, 축소된 사이드바 |
| desktop | ≥ 1024px | 사이드바 + 메인 컨텐츠 |

---

## 접근성 (a11y)

- 시맨틱 HTML: `<header>`, `<nav>`, `<main>`, `<aside>`
- ARIA 라벨: 한국어 (`aria-label="주요 네비게이션"`)
- 포커스 링: 3px, sky 색상
- 키보드 네비게이션: Radix UI 기본 지원
- 색상 대비: WCAG AA 기준 충족
- `prefers-reduced-motion` 존중
