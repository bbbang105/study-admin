# Landing Page Redesign + Logo/Favicon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 현재 미니멀 랜딩 페이지를 Linear/Vercel 스타일 다크 모드 원페이지로 리디자인하고, 커스텀 로고/파비콘을 창작하여 PWA까지 적용한다.

**Architecture:** 랜딩 페이지는 독립된 다크 테마 원페이지 (앱 내부 테마와 분리). Framer Motion으로 풀 애니메이션. 서버 컴포넌트에서 DB 스탯 fetch. 로고는 SVG 픽토그램으로 창작하여 파비콘/PWA 아이콘/앱 내부 모두 적용.

**Tech Stack:** Next.js 16, React 19, Framer Motion, Tailwind CSS v4, Supabase (stats), Lucide React, DiceBear API

---

### Task 1: framer-motion 설치

**Files:**
- Modify: `packages/web/package.json`

**Step 1: 패키지 설치**

Run: `cd /Users/hansangho/Desktop/study-admin && pnpm --filter @blog-study/web add framer-motion`

**Step 2: 설치 확인**

Run: `cd /Users/hansangho/Desktop/study-admin/packages/web && node -e "require('framer-motion')"`
Expected: 에러 없음

**Step 3: Commit**

```bash
git add packages/web/package.json pnpm-lock.yaml
git commit -m "feat: framer-motion 설치 (랜딩 페이지 애니메이션용)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 로고 SVG 픽토그램 창작

**Files:**
- Create: `packages/web/public/icon.svg` (덮어쓰기)
- Create: `packages/web/public/logo.svg` (풀 로고 — 심볼 + 텍스트)

**Step 1: 아이콘 SVG 작성**

펜촉 + 우상향 화살표 합성 픽토그램. 큐시즘 블루 그라디언트 (`#0091FF → #004DFF`).

`packages/web/public/icon.svg`:
```svg
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0091FF"/>
      <stop offset="1" stop-color="#004DFF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="#0a0a0a"/>
  <!-- 펜촉 (글쓰기) + 우상향 화살표 (성장) 합성 -->
  <path d="M 160 352 L 280 130 L 310 130 L 350 170 L 230 352 Z" fill="url(#brand)" opacity="0.9"/>
  <path d="M 155 357 L 175 310 L 202 337 Z" fill="url(#brand)"/>
  <path d="M 280 200 L 350 130 L 370 150 L 300 220 Z" fill="url(#brand)" opacity="0.8"/>
  <!-- 우상향 화살표 (성장 심볼) -->
  <path d="M 290 120 L 370 120 L 370 200" stroke="url(#brand)" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
```

> 주의: 위 SVG는 초안 — 실제 구현 시 시각적으로 조정하여 완성도 높은 픽토그램으로 마무리할 것.

**Step 2: 풀 로고 SVG 작성**

`packages/web/public/logo.svg` — 아이콘 + "블로그 스터디" 텍스트 조합

**Step 3: PNG 생성 (192/512)**

Run:
```bash
# sharp CLI로 SVG → PNG 변환 (없으면 npx로)
cd /Users/hansangho/Desktop/study-admin/packages/web/public
npx sharp-cli -i icon.svg -o icon-192.png resize 192 192
npx sharp-cli -i icon.svg -o icon-512.png resize 512 512
```

만약 sharp-cli가 안 되면 다른 방식으로 변환 (sips 등 macOS 기본 도구 활용).

**Step 4: manifest.json 업데이트**

`packages/web/public/manifest.json`:
```json
{
  "name": "블로그 스터디",
  "short_name": "블로그 스터디",
  "description": "블로그 글쓰기 스터디 자동화 플랫폼",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0055FF",
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Step 5: layout.tsx themeColor 업데이트**

`packages/web/src/app/layout.tsx` 라인 8:
```typescript
themeColor: '#0055FF',
```

**Step 6: Commit**

```bash
git add packages/web/public/icon.svg packages/web/public/logo.svg packages/web/public/icon-192.png packages/web/public/icon-512.png packages/web/public/manifest.json packages/web/src/app/layout.tsx
git commit -m "feat: 커스텀 로고 픽토그램 + 파비콘/PWA 아이콘 적용

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 랜딩 페이지 애니메이션 컴포넌트 생성

**Files:**
- Create: `packages/web/src/components/landing/motion.tsx`

**Step 1: 재사용 모션 컴포넌트 작성**

`packages/web/src/components/landing/motion.tsx`:
```tsx
'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

// Fade-up animation wrapper (scroll-triggered)
export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger container for children
export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Count-up number animation
export function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1500;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// Draw line animation (for How It Works connector)
export function DrawLine({ className }: { className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ scaleX: 0 }}
      animate={inView ? { scaleX: 1 } : {}}
      transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
      style={{ transformOrigin: 'left' }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add packages/web/src/components/landing/motion.tsx
git commit -m "feat: 랜딩 페이지 모션 컴포넌트 (FadeUp, StaggerContainer, CountUp, DrawLine)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 랜딩 페이지 CSS (globals.css 랜딩 전용 스타일 추가)

**Files:**
- Modify: `packages/web/src/app/globals.css` (하단에 추가)

**Step 1: 랜딩 전용 CSS 추가**

`globals.css` 맨 하단에 추가:
```css
/* ── Landing Page ── */
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.animate-marquee {
  animation: marquee 30s linear infinite;
}

.landing-glow {
  background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0, 85, 255, 0.15) 0%, transparent 70%);
}

.landing-glow-bottom {
  background: radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0, 85, 255, 0.1) 0%, transparent 70%);
}

.gradient-text {
  background: linear-gradient(135deg, #0091FF 0%, #004DFF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.glow-button {
  box-shadow: 0 0 20px rgba(0, 85, 255, 0.3), 0 0 60px rgba(0, 85, 255, 0.1);
  transition: box-shadow 0.3s ease;
}
.glow-button:hover {
  box-shadow: 0 0 30px rgba(0, 85, 255, 0.5), 0 0 80px rgba(0, 85, 255, 0.2);
}

.bento-card {
  background: rgba(24, 24, 27, 0.5);
  border: 1px solid rgba(63, 63, 70, 0.5);
  transition: border-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
}
.bento-card:hover {
  border-color: rgba(0, 85, 255, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 24px rgba(0, 85, 255, 0.1);
}

.grid-pattern {
  background-image:
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 64px 64px;
}
```

**Step 2: Commit**

```bash
git add packages/web/src/app/globals.css
git commit -m "feat: 랜딩 페이지 전용 CSS (글로우, 벤토 카드, 마키, 그리드 패턴)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 랜딩 페이지 메인 — Hero + Nav 섹션

**Files:**
- Modify: `packages/web/src/app/page.tsx` (전체 리라이트)

**Step 1: page.tsx 리라이트 — Hero + Nav**

`packages/web/src/app/page.tsx`:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@blog-study/shared';
import { members, posts, rounds } from '@blog-study/shared/schema';
import { eq, count, and } from 'drizzle-orm';
import { LandingClient } from '@/components/landing/landing-client';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!error && user) redirect('/dashboard');

  // Stats: 활성 멤버수, 총 포스트수, 현재 회차
  const [memberCount, postCount, currentRound] = await Promise.all([
    db.select({ count: count() }).from(members).where(eq(members.status, 'active')),
    db.select({ count: count() }).from(posts),
    db.select({ roundNumber: rounds.roundNumber }).from(rounds).where(eq(rounds.isCurrent, true)),
  ]);

  const stats = {
    members: memberCount[0]?.count ?? 0,
    posts: postCount[0]?.count ?? 0,
    round: currentRound[0]?.roundNumber ?? 0,
  };

  return <LandingClient stats={stats} />;
}
```

**Step 2: 클라이언트 컴포넌트 생성**

- Create: `packages/web/src/components/landing/landing-client.tsx`

이 파일에 전체 랜딩 페이지 UI 구현 (7개 섹션).
Hero, Stats, Bento, How It Works, Social Proof, Final CTA, Footer 모두 포함.

핵심 구조:
```tsx
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Rss, Trophy, CalendarCheck, Banknote, MessageSquare, Newspaper, LogIn, ArrowRight, Users, FileText, Clock } from 'lucide-react';
import { FadeUp, StaggerContainer, StaggerItem, CountUp, DrawLine } from './motion';

interface Props {
  stats: { members: number; posts: number; round: number };
}

export function LandingClient({ stats }: Props) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      {/* Hero with glow */}
      {/* Stats Bar */}
      {/* Features Bento */}
      {/* How It Works */}
      {/* Avatar Marquee */}
      {/* Final CTA + Footer */}
    </div>
  );
}
```

각 섹션의 상세 코드는 구현 시 작성 (디자인 문서 참조: `docs/plans/26-03-08-landing-page-redesign-design.md`)

**핵심 패턴:**
- Nav: `sticky top-0 z-50 bg-black/80 backdrop-blur-xl`, 스크롤 시 border-b 전환
- Hero: `landing-glow` + `gradient-text` + motion fade-up stagger
- Stats: `CountUp` 컴포넌트 3개 횡렬
- Bento: 2-col 비대칭 grid, `bento-card` class, `StaggerContainer` + `StaggerItem`
- How It Works: 3-step + `DrawLine` 커넥터
- Marquee: DiceBear `fun-emoji` 아바타 20개 + `animate-marquee` CSS
- Final CTA: `landing-glow-bottom` + 글로우 버튼 반복
- Footer: `Powered by KUSITMS`

**Step 3: 빌드 확인**

Run: `cd /Users/hansangho/Desktop/study-admin && pnpm --filter @blog-study/web build`
Expected: 빌드 성공

**Step 4: Commit**

```bash
git add packages/web/src/app/page.tsx packages/web/src/components/landing/landing-client.tsx
git commit -m "feat: 랜딩 페이지 리디자인 — Linear 스타일 다크 모드 원페이지

- Hero: 그라디언트 텍스트 + 블루 글로우 + 풀 진입 애니메이션
- Stats Bar: 실시간 DB 데이터 + 카운트업 애니메이션
- Features: 비대칭 벤토 그리드 + 호버 글로우
- How It Works: 3-step 타임라인 + draw 애니메이션
- Social Proof: DiceBear 아바타 마키
- 큐시즘 블루 그라디언트 (#0091FF → #004DFF) 적용

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 앱 내부 로고 교체 (사이드바 등)

**Files:**
- Modify: `packages/web/src/components/layout/sidebar.tsx` (로고 부분)
- 기타 "BS" 텍스트 로고 사용처 모두 교체

**Step 1: 사이드바 로고를 SVG 픽토그램으로 교체**

현재 사이드바에 로고가 없다면, 헤더나 다른 곳에서 "BS" 텍스트를 사용하는 곳을 찾아 SVG 로고로 교체.

```tsx
import Image from 'next/image';

// 로고 사용처:
<Image src="/icon.svg" alt="블로그 스터디" width={28} height={28} />
<span className="text-sm font-semibold">블로그 스터디</span>
```

**Step 2: Commit**

```bash
git add packages/web/src/components/layout/sidebar.tsx
git commit -m "feat: 앱 내부 로고를 커스텀 픽토그램으로 교체

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 반응형 + 빌드 검증

**Step 1: 타입 체크**

Run: `cd /Users/hansangho/Desktop/study-admin && pnpm typecheck`
Expected: 에러 없음

**Step 2: 린트**

Run: `cd /Users/hansangho/Desktop/study-admin && pnpm lint`
Expected: 에러 없음

**Step 3: 빌드**

Run: `cd /Users/hansangho/Desktop/study-admin && pnpm build`
Expected: 전체 빌드 성공

**Step 4: 로컬 확인**

Run: `cd /Users/hansangho/Desktop/study-admin && pnpm dev:web`
- `http://localhost:3300` 접속
- 다크 모드 랜딩 페이지 확인
- 모바일 뷰포트(375px) 확인
- 애니메이션 동작 확인
- PWA 아이콘 확인 (개발자 도구 → Application → Manifest)

**Step 5: 수정 사항 있으면 Commit**

```bash
git add -p  # 변경 파일만 선택
git commit -m "fix: 랜딩 페이지 반응형 + 빌드 이슈 수정

Co-Authored-By: Claude <noreply@anthropic.com>"
```
