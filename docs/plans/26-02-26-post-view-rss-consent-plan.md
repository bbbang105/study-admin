# Post View Scoring + RSS Consent + Manual Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 글 조회 시 활동 점수 부여, RSS 수집 동의 설정, 수동 글 등록 기능 추가

**Architecture:** DB 스키마에 `rss_consent` 컬럼과 `post_views` 테이블 추가. 웹에서 글 클릭 시 fire-and-forget으로 조회 점수 API 호출. 온보딩/프로필 편집에 RSS 동의 토글 추가. 수동 글 등록은 OG 태그 크롤링 기반 모달로 구현.

**Tech Stack:** Drizzle ORM, Next.js 14 App Router, shadcn/ui, Radix Switch

---

### Task 1: DB 스키마 변경

**Files:**
- Modify: `packages/shared/src/db/schema.ts`

**Step 1: ActivityScoreType에 POST_VIEW 추가**

`schema.ts:60-68`의 `ActivityScoreType` 객체에 추가:

```typescript
export const ActivityScoreType = {
  BLOG_POST: 'blog_post',
  DISCORD_MESSAGE: 'discord_message',
  DISCORD_THREAD: 'discord_thread',
  DISCORD_REACTION: 'discord_reaction',
  ADMIN_MANUAL: 'admin_manual',
  POST_VIEW: 'post_view',
} as const;
```

**Step 2: members 테이블에 rss_consent 추가**

`schema.ts:93` 부근, `onboardingCompleted` 아래에 추가:

```typescript
    rssConsent: boolean('rss_consent').default(true),
```

**Step 3: post_views 테이블 추가**

`activityScores` 테이블 정의 뒤 (~line 280)에 추가:

```typescript
/**
 * 글 조회 기록 (Post Views)
 * 글 조회 점수 중복 방지용
 */
export const postViews = pgTable(
  'post_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    memberPostUnique: uniqueIndex('post_views_member_post_unique').on(
      table.memberId,
      table.postId
    ),
    memberIdIdx: index('idx_post_views_member_id').on(table.memberId),
  })
);
```

**Step 4: post_views 타입 export 추가**

`schema.ts` 하단 타입 export 섹션에 추가:

```typescript
export type PostView = typeof postViews.$inferSelect;
export type NewPostView = typeof postViews.$inferInsert;
```

**Step 5: postViews relations 추가**

relations 섹션에 추가:

```typescript
export const postViewsRelations = relations(postViews, ({ one }) => ({
  member: one(members, {
    fields: [postViews.memberId],
    references: [members.id],
  }),
  post: one(posts, {
    fields: [postViews.postId],
    references: [posts.id],
  }),
}));
```

members relations에 postViews 추가:
```typescript
export const membersRelations = relations(members, ({ many }) => ({
  posts: many(posts),
  attendance: many(attendance),
  fines: many(fines),
  activityScores: many(activityScores),
  postViews: many(postViews),
}));
```

**Step 6: shared 패키지 리빌드**

Run: `pnpm --filter @blog-study/shared build`

**Step 7: DB 마이그레이션 생성 및 적용**

Run: `pnpm --filter @blog-study/shared drizzle-kit generate`
Run: `pnpm --filter @blog-study/shared drizzle-kit push`

**Step 8: Commit**

```bash
git add packages/shared/src/db/schema.ts
git commit -m "feat: post_views 테이블, POST_VIEW 타입, rss_consent 컬럼 추가"
```

---

### Task 2: Switch UI 컴포넌트 추가

**Files:**
- Create: `packages/web/src/components/ui/switch.tsx`

**Step 1: shadcn Switch 컴포넌트 설치**

Run: `cd packages/web && npx shadcn@latest add switch --yes`

만약 CLI가 안 되면 수동 생성:

```typescript
"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

의존성 확인:
Run: `cd packages/web && pnpm list @radix-ui/react-switch 2>/dev/null || pnpm add @radix-ui/react-switch`

**Step 2: Commit**

```bash
git add packages/web/src/components/ui/switch.tsx
git commit -m "feat: Switch UI 컴포넌트 추가"
```

---

### Task 3: 온보딩 Step 1에 RSS 동의 토글 추가

**Files:**
- Modify: `packages/web/src/app/(user)/profile/onboarding/page.tsx`
- Modify: `packages/web/src/app/api/profile/onboarding/route.ts`

**Step 1: 온보딩 페이지에 rssConsent state 추가**

`onboarding/page.tsx` import에 Switch 추가:
```typescript
import { Switch } from '@/components/ui/switch';
```

form state 섹션 (~line 39)에 추가:
```typescript
const [rssConsent, setRssConsent] = useState(true);
```

**Step 2: Step 1 UI에 토글 추가**

Blog URL 입력 필드의 `<p className="text-xs text-muted-foreground">` 안내 텍스트 바로 아래, `<Separator />` 바로 위에 RSS 동의 토글 추가:

```tsx
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="rssConsent" className="text-sm font-medium">
                  RSS 자동 수집 동의
                </Label>
                {!rssConsent && (
                  <p className="text-xs text-muted-foreground">
                    RSS 수집을 비활성화하면 글을 직접 등록해야 합니다.
                  </p>
                )}
              </div>
              <Switch
                id="rssConsent"
                checked={rssConsent}
                onCheckedChange={setRssConsent}
              />
            </div>
```

**Step 3: handleSubmit에 rssConsent 포함**

`handleSubmit` 함수의 body JSON에 추가:
```typescript
          rssConsent,
```

**Step 4: 온보딩 API에 rssConsent 처리 추가**

`onboarding/route.ts`의 body 디스트럭처링에 `rssConsent` 추가:
```typescript
const { name, nickname, part, blogUrl, profileImageUrl, bio, interests, resolution, githubUrl, linkedinUrl, instagramUrl, rssConsent } = body;
```

기존 유저 UPDATE set 객체와 신규 유저 INSERT values 객체 모두에 추가:
```typescript
          rssConsent: rssConsent !== false,
```

**Step 5: Commit**

```bash
git add packages/web/src/app/(user)/profile/onboarding/page.tsx packages/web/src/app/api/profile/onboarding/route.ts
git commit -m "feat: 온보딩 Step 1에 RSS 자동 수집 동의 토글 추가"
```

---

### Task 4: 프로필 편집에 RSS 동의 토글 추가

**Files:**
- Modify: `packages/web/src/app/(user)/profile/edit/page.tsx`
- Modify: `packages/web/src/app/api/profile/edit/route.ts`
- Modify: `packages/web/src/app/api/profile/route.ts` (rssConsent 반환 추가)

**Step 1: Profile API에서 rssConsent 반환**

`/api/profile/route.ts`에서 member 데이터 반환 시 `rssConsent` 필드가 포함되도록 확인. (members 테이블 전체 select 시 자동 포함될 수 있으나, 명시적 select인 경우 추가 필요)

**Step 2: 프로필 편집 페이지에 rssConsent state 추가**

`edit/page.tsx` import에 Switch 추가:
```typescript
import { Switch } from '@/components/ui/switch';
```

ProfileData 인터페이스의 member에 추가:
```typescript
    rssConsent: boolean;
```

form state에 추가:
```typescript
const [rssConsent, setRssConsent] = useState(true);
```

fetchProfile의 pre-fill 로직에 추가:
```typescript
        if (data.member.rssConsent !== undefined) setRssConsent(data.member.rssConsent);
```

**Step 3: 소셜 링크 카드 위에 RSS 설정 카드 추가**

소셜 링크 Card 바로 위에 새 Card 추가:

```tsx
        {/* RSS 설정 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>RSS 설정</CardTitle>
            </div>
            <CardDescription>
              블로그 글 자동 수집 설정을 관리하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="rssConsent" className="text-sm font-medium">
                  RSS 자동 수집 동의
                </Label>
                {!rssConsent && (
                  <p className="text-xs text-muted-foreground">
                    RSS 수집을 비활성화하면 글을 직접 등록해야 합니다.
                  </p>
                )}
              </div>
              <Switch
                id="rssConsent"
                checked={rssConsent}
                onCheckedChange={setRssConsent}
              />
            </div>
          </CardContent>
        </Card>
```

**Step 4: handleSubmit에 rssConsent 포함**

```typescript
          rssConsent,
```

**Step 5: 프로필 편집 API에 rssConsent 처리**

`/api/profile/edit/route.ts`의 body 디스트럭처링에 `rssConsent` 추가:
```typescript
const { name, nickname, part, profileImageUrl, bio, interests, resolution, githubUrl, linkedinUrl, instagramUrl, rssConsent } = body;
```

update set 객체에 추가:
```typescript
        ...(typeof rssConsent === 'boolean' ? { rssConsent } : {}),
```

**Step 6: Commit**

```bash
git add packages/web/src/app/(user)/profile/edit/page.tsx packages/web/src/app/api/profile/edit/route.ts packages/web/src/app/api/profile/route.ts
git commit -m "feat: 프로필 편집에 RSS 동의 설정 추가"
```

---

### Task 5: 봇 RSS Poller에서 rss_consent 필터링

**Files:**
- Modify: `packages/bot/src/schedulers/rss-poller.ts`

**Step 1: getMembersToPoll에 rssConsent 필터 추가**

`rss-poller.ts:60` 필터를 수정:

```typescript
  async getMembersToPoll(): Promise<Member[]> {
    const memberService = getMemberService();
    const activeMembers = await memberService.getAllByStatus(MemberStatus.ACTIVE);

    // Only poll members with RSS URLs and RSS consent
    return activeMembers.filter(member => member.rssUrl && member.rssConsent !== false);
  }
```

**Step 2: Commit**

```bash
git add packages/bot/src/schedulers/rss-poller.ts
git commit -m "feat: RSS 폴링 시 rss_consent=false 멤버 스킵"
```

---

### Task 6: ScoreService에 POST_VIEW 설정 추가

**Files:**
- Modify: `packages/bot/src/services/score.service.ts`

**Step 1: SCORE_CONFIG에 POST_VIEW 추가**

`score.service.ts:18` 뒤에 추가:

```typescript
  [ActivityScoreType.POST_VIEW]: { points: 2, dailyCap: 10 },
```

**Step 2: shared 리빌드**

Run: `pnpm --filter @blog-study/shared build`

**Step 3: Commit**

```bash
git add packages/bot/src/services/score.service.ts
git commit -m "feat: ScoreService에 POST_VIEW 점수 설정 추가 (2점, 일일 10점)"
```

---

### Task 7: 글 조회 점수 API 구현

**Files:**
- Create: `packages/web/src/app/api/posts/[id]/view/route.ts`

**Step 1: API Route 구현**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';

const { posts, members, postViews, activityScores, ActivityScoreType } = sharedDb;

const POST_VIEW_POINTS = 2;
const POST_VIEW_DAILY_CAP = 10;

function getTodayDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0]!;
}

/**
 * POST /api/posts/[id]/view
 * 글 조회 시 활동 점수 부여
 * - 본인 글 제외
 * - 같은 글 중복 조회 불가 (post_views UNIQUE)
 * - 하루 최대 5회 (10점)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    // Discord ID로 멤버 조회
    const discordIdentity = user.identities?.find(
      (identity) => identity.provider === 'discord'
    );
    const discordId = discordIdentity?.id;
    if (!discordId) {
      return NextResponse.json({ message: 'Discord 계정이 필요합니다.' }, { status: 400 });
    }

    const database = db();

    const [member] = await database
      .select({ id: members.id })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!member) {
      return NextResponse.json({ message: '멤버 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 포스트 존재 확인 + 작성자 체크
    const [post] = await database
      .select({ id: posts.id, memberId: posts.memberId, title: posts.title })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json({ message: '포스트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 본인 글 제외
    if (post.memberId === member.id) {
      return NextResponse.json({ scored: false, reason: 'own_post' });
    }

    // 중복 조회 체크 + 삽입 (INSERT ON CONFLICT DO NOTHING)
    const insertResult = await database.execute(sql`
      INSERT INTO post_views (id, member_id, post_id)
      VALUES (gen_random_uuid(), ${member.id}, ${postId})
      ON CONFLICT (member_id, post_id) DO NOTHING
      RETURNING id
    `);

    if (insertResult.length === 0) {
      // 이미 조회한 글
      return NextResponse.json({ scored: false, reason: 'already_viewed' });
    }

    // 일일 상한 체크 후 점수 부여 (원자적 CTE)
    const today = getTodayDateString();
    const scoreResult = await database.execute(sql`
      WITH daily AS (
        SELECT COALESCE(SUM(${activityScores.points}), 0) AS total
        FROM ${activityScores}
        WHERE ${activityScores.memberId} = ${member.id}
          AND ${activityScores.type} = ${ActivityScoreType.POST_VIEW}
          AND ${activityScores.date} = ${today}
      )
      INSERT INTO activity_scores (id, member_id, type, points, description, date)
      SELECT gen_random_uuid(), ${member.id}, ${ActivityScoreType.POST_VIEW}, ${POST_VIEW_POINTS},
        ${`글 조회: ${post.title.replace(/[<>"'&]/g, '').slice(0, 200)}`}, ${today}
      FROM daily
      WHERE daily.total < ${POST_VIEW_DAILY_CAP}
      RETURNING points
    `);

    const scored = scoreResult.length > 0;

    return NextResponse.json({
      scored,
      points: scored ? POST_VIEW_POINTS : 0,
      reason: scored ? 'success' : 'daily_cap',
    });
  } catch (error) {
    console.error('Post view API error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add packages/web/src/app/api/posts/[id]/view/route.ts
git commit -m "feat: 글 조회 점수 API 구현 (POST /api/posts/[id]/view)"
```

---

### Task 8: 글 목록 페이지에 조회 점수 트래킹 추가

**Files:**
- Modify: `packages/web/src/app/(user)/posts/page.tsx`

**Step 1: trackPostView 함수 추가**

PostsContent 컴포넌트 내, handlePageChange 함수 아래에 추가:

```typescript
  const trackPostView = (postId: string) => {
    fetch(`/api/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
  };
```

**Step 2: 모바일 뷰 클릭 핸들러 추가**

모바일 `<a>` 태그에 onClick 추가:
```tsx
                <a
                  key={post.id}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 py-3 group"
                  onClick={() => trackPostView(post.id)}
                >
```

**Step 3: 데스크톱 뷰 클릭 핸들러 추가**

데스크톱 제목 `<a>` 태그에 onClick 추가:
```tsx
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline underline-offset-4 line-clamp-1 font-medium"
                        onClick={() => trackPostView(post.id)}
                      >
```

데스크톱 링크 버튼의 `<a>` 태그에도 onClick 추가:
```tsx
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackPostView(post.id)}
                        >
```

**Step 4: Commit**

```bash
git add packages/web/src/app/(user)/posts/page.tsx
git commit -m "feat: 글 목록에서 클릭 시 조회 점수 fire-and-forget 트래킹"
```

---

### Task 9: 수동 글 등록 API 구현

**Files:**
- Create: `packages/web/src/app/api/posts/manual/route.ts`

**Step 1: OG 크롤링 + 수동 등록 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';

const { posts, members, rounds, activityScores, ActivityScoreType } = sharedDb;
import { sql } from 'drizzle-orm';

const BLOG_POST_POINTS = 30;
const BLOG_POST_DAILY_CAP = 60;

function getTodayDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0]!;
}

/**
 * OG 태그에서 제목과 발행일 추출
 */
async function fetchOgData(url: string): Promise<{ title: string | null; publishedAt: string | null }> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return { title: null, publishedAt: null };

    const html = await response.text();

    // title: og:title > <title>
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || null;

    // publishedAt: article:published_time > og:article:published_time
    const pubMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i);
    const publishedAt = pubMatch?.[1] || null;

    return { title: title?.trim() || null, publishedAt };
  } catch {
    return { title: null, publishedAt: null };
  }
}

/**
 * POST /api/posts/manual
 * 수동 글 등록
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const discordIdentity = user.identities?.find(
      (identity) => identity.provider === 'discord'
    );
    const discordId = discordIdentity?.id;
    if (!discordId) {
      return NextResponse.json({ message: 'Discord 계정이 필요합니다.' }, { status: 400 });
    }

    const body = await request.json();
    const { url, title: manualTitle } = body;

    // URL 필수
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ message: 'URL은 필수입니다.' }, { status: 400 });
    }

    // URL 형식 검증
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json({ message: 'http 또는 https URL만 허용됩니다.' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ message: '유효하지 않은 URL입니다.' }, { status: 400 });
    }

    const database = db();

    // 멤버 조회
    const [member] = await database
      .select({ id: members.id })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!member) {
      return NextResponse.json({ message: '멤버 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 중복 URL 체크
    const [existing] = await database
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.url, url))
      .limit(1);

    if (existing) {
      return NextResponse.json({ message: '이미 등록된 URL입니다.' }, { status: 409 });
    }

    // OG 크롤링 시도
    let title = manualTitle as string | null;
    let publishedAt: Date = new Date();
    let crawlFailed = false;

    if (!title) {
      const ogData = await fetchOgData(url);
      if (ogData.title) {
        title = ogData.title;
        if (ogData.publishedAt) {
          publishedAt = new Date(ogData.publishedAt);
        }
      } else {
        crawlFailed = true;
      }
    }

    // 크롤링 실패 + 수동 제목 없음
    if (!title) {
      return NextResponse.json(
        { message: '제목을 자동으로 가져올 수 없습니다. 직접 입력해주세요.', needsTitle: true },
        { status: 422 }
      );
    }

    // 현재 회차 조회
    const [currentRound] = await database
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.isCurrent, true))
      .limit(1);

    // 포스트 등록
    const [newPost] = await database
      .insert(posts)
      .values({
        memberId: member.id,
        roundId: currentRound?.id ?? null,
        title,
        url,
        publishedAt,
      })
      .returning();

    // 블로그 포스트 점수 부여 (기존과 동일: 30점, 일일 60점 상한)
    const today = getTodayDateString();
    const safeTitle = title.replace(/[<>"'&]/g, '').slice(0, 200);
    await database.execute(sql`
      WITH daily AS (
        SELECT COALESCE(SUM(points), 0) AS total
        FROM activity_scores
        WHERE member_id = ${member.id}
          AND type = ${ActivityScoreType.BLOG_POST}
          AND date = ${today}
      )
      INSERT INTO activity_scores (id, member_id, type, points, description, date)
      SELECT gen_random_uuid(), ${member.id}, ${ActivityScoreType.BLOG_POST}, ${BLOG_POST_POINTS},
        ${`블로그 포스트: ${safeTitle}`}, ${today}
      FROM daily
      WHERE daily.total < ${BLOG_POST_DAILY_CAP}
      RETURNING points
    `);

    return NextResponse.json({
      message: '글이 등록되었습니다.',
      post: newPost,
    });
  } catch (error) {
    console.error('Manual post API error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add packages/web/src/app/api/posts/manual/route.ts
git commit -m "feat: 수동 글 등록 API (OG 크롤링 + 점수 부여)"
```

---

### Task 10: 글 목록 페이지에 수동 등록 모달 추가

**Files:**
- Modify: `packages/web/src/app/(user)/posts/page.tsx`

**Step 1: import 추가**

```typescript
import { Plus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
```

**Step 2: PostsContent 컴포넌트 내에 모달 state 추가**

```typescript
  const [dialogOpen, setDialogOpen] = useState(false);
  const [postUrl, setPostUrl] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [needsTitle, setNeedsTitle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
```

**Step 3: handleManualSubmit 함수 추가**

```typescript
  const handleManualSubmit = async () => {
    if (!postUrl.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const body: Record<string, string> = { url: postUrl.trim() };
      if (needsTitle && postTitle.trim()) {
        body.title = postTitle.trim();
      }

      const response = await fetch('/api/posts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.status === 422 && result.needsTitle) {
        setNeedsTitle(true);
        setSubmitError(result.message);
        return;
      }

      if (!response.ok) {
        setSubmitError(result.message || '등록에 실패했습니다.');
        return;
      }

      // 성공 → 모달 닫기 + 새로고침
      setDialogOpen(false);
      setPostUrl('');
      setPostTitle('');
      setNeedsTitle(false);
      // 페이지 데이터 새로고침
      window.location.reload();
    } catch {
      setSubmitError('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetDialog = () => {
    setPostUrl('');
    setPostTitle('');
    setNeedsTitle(false);
    setSubmitError(null);
  };
```

**Step 4: 헤더에 "글 등록" 버튼 + Dialog 추가**

CardHeader 내 우측 "총 N개" 텍스트를 버튼으로 교체:

기존:
```tsx
          <span className="text-xs text-muted-foreground">
            총 {data?.pagination.totalCount ?? 0}개
          </span>
```

변경:
```tsx
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              총 {data?.pagination.totalCount ?? 0}개
            </span>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetDialog(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  글 등록
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>글 등록</DialogTitle>
                  <DialogDescription>
                    블로그 글 URL을 입력하면 제목이 자동으로 추출됩니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="postUrl">URL</Label>
                    <Input
                      id="postUrl"
                      placeholder="https://velog.io/@username/post-title"
                      value={postUrl}
                      onChange={(e) => setPostUrl(e.target.value)}
                    />
                  </div>
                  {needsTitle && (
                    <div className="space-y-2">
                      <Label htmlFor="postTitle">
                        제목 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="postTitle"
                        placeholder="글 제목을 직접 입력해주세요"
                        value={postTitle}
                        onChange={(e) => setPostTitle(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        제목을 자동으로 가져올 수 없습니다. 직접 입력해주세요.
                      </p>
                    </div>
                  )}
                  {submitError && !needsTitle && (
                    <p className="text-sm text-destructive">{submitError}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleManualSubmit}
                    disabled={submitting || !postUrl.trim() || (needsTitle && !postTitle.trim())}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        등록 중...
                      </>
                    ) : (
                      '등록'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
```

**Step 5: Commit**

```bash
git add packages/web/src/app/(user)/posts/page.tsx
git commit -m "feat: 글 목록에 수동 글 등록 모달 추가"
```

---

### Task 11: 빌드 검증

**Step 1: shared 리빌드**

Run: `pnpm --filter @blog-study/shared build`

**Step 2: 웹 타입체크**

Run: `pnpm typecheck`

**Step 3: 린트**

Run: `pnpm lint`

**Step 4: 웹 빌드**

Run: `pnpm build`

**Step 5: 오류 수정 후 최종 커밋**

```bash
git add -p  # 변경된 파일만 선택적 추가
git commit -m "fix: 빌드 오류 수정"
```
