# API 패턴 & 코드 규칙

## 관리자 API 인증 패턴

### withAdminAuth 래퍼 (권장)

```ts
// packages/web/src/lib/admin.ts 의 withAdminAuth 사용
import { withAdminAuth } from '@/lib/admin';

export const GET = withAdminAuth(async (request: NextRequest, adminAuth) => {
  // adminAuth.discordId — 관리자의 Discord ID
  // adminAuth.userId — Supabase user ID
  const database = db();
  // ... DB 조회 로직
  return NextResponse.json({ data });
});
```

### 인증 흐름
```
createClient() → getUser() → identities[].find(p => p.provider === 'discord').id
→ isAdminDiscordId(discordId) → 관리자 확인
```

### 관련 파일
| 파일 | 역할 |
|------|------|
| `packages/web/src/lib/admin.ts` | `withAdminAuth`, `verifyAdminAccess`, `isAdminDiscordId` |
| `packages/web/src/lib/supabase/server.ts` | `createClient()` — 서버용 Supabase |
| `packages/web/src/lib/supabase/client.ts` | 브라우저용 Supabase |
| `packages/web/src/lib/db.ts` | `db()` — shared DB 인스턴스 래퍼 |

## Drizzle ORM Import 패턴

```ts
// shared 패키지에서 스키마 + enum import
import { db as sharedDb } from '@blog-study/shared';
const { members, posts, attendance, MemberStatus, AttendanceStatus } = sharedDb;

// drizzle-orm 연산자
import { eq, count, sql, asc, desc, and, or, inArray } from 'drizzle-orm';

// DB 인스턴스 (web 패키지)
import { db } from '@/lib/db';
const database = db();
```

## API Route 기본 구조 (Next.js App Router)

```ts
// packages/web/src/app/api/admin/{resource}/route.ts
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';
import { errorResponse, successResponse } from '@/lib/api-error';

const { members } = sharedDb;

// GET — 목록 조회
export const GET = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const database = db();
    const result = await database.select().from(members);
    return successResponse({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
});

// POST — 생성
export const POST = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const body = await request.json();
    // validation → insert → returning
    return successResponse(newItem, '생성되었습니다.', 201);
  } catch (error) {
    return errorResponse(error);
  }
});
```

### 동적 라우트 (패턴: `/api/admin/{resource}/[id]/route.ts`)

```ts
// PATCH — 수정
export const PATCH = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  const id = request.url.split('/').pop(); // 또는 params에서 추출
  // update → returning
});

// DELETE — 삭제
export const DELETE = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  const id = request.url.split('/').pop();
  // delete → returning
});
```

## 일반 사용자 API 패턴

```ts
// 인증만 필요, 관리자 권한 불필요
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors, successResponse, withCache } from '@/lib/api-error';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Errors.unauthorized().toResponse();

    const discordId = user.identities?.find(i => i.provider === 'discord')?.id;
    // discordId로 members 테이블 조회
    return withCache(successResponse(data), 60); // 읽기 전용은 캐시 적용
  } catch (error) {
    return errorResponse(error);
  }
}
```

## 멤버 상태 리다이렉트 패턴

서버 + 클라이언트 이중 체크로 차단 상태 사용자의 접근을 제어:

### 1. OAuth 콜백 (서버 사이드)

```ts
// packages/web/src/app/auth/callback/route.ts
// 로그인 직후 DB에서 status 조회 → 상태별 리다이렉트
if (!memberData || !memberData.onboardingCompleted) → /profile/onboarding
if (memberData.status === 'pending_approval') → /pending
if (memberData.status === 'inactive') → /inactive
```

### 2. UserLayout (클라이언트 사이드)

```ts
// packages/web/src/app/(user)/layout.tsx
// checkedPathname 패턴: pathname 변경 시 자동으로 로딩 상태 진입 (플래시 방지)
const [checkedPathname, setCheckedPathname] = useState<string | null>(null);

// /api/auth/me 응답의 status 필드로 리다이렉트 판단
// 차단 페이지 자체는 예외 처리: blockedPages = ['/pending', '/inactive']

// 로딩 가드: checkedPathname !== pathname이면 로딩 표시
if (checkedPathname !== pathname && pathname !== '/profile/onboarding') → 로딩
```

### 주의사항
- `(admin)` 레이아웃은 별도 인증 → 멤버 상태 체크 없음 (관리자가 스스로 승인 가능)
- `pending`/`inactive` 페이지는 `(user)` 그룹 내에 있지만 리다이렉트 예외 처리됨

## 다이얼로그 패턴

`window.confirm()`/`window.alert()`/`window.prompt()` 사용 금지. 커스텀 다이얼로그 사용:

```tsx
// AlertDialog (shadcn/ui) 패턴 — DeletePostDialog 참고
<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>제목</AlertDialogTitle>
      <AlertDialogDescription>설명</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>취소</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirm}>확인</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## 게시판 API 인증 패턴

관리자 전용이 아닌 일반 사용자 API는 `getBoardAuth` + `successResponse`/`Errors` 조합 사용:

```ts
// packages/web/src/lib/board-auth.ts
import { getBoardAuth } from '@/lib/board-auth';
import { successResponse, errorResponse, Errors } from '@/lib/api-error';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id } = await params;
    const database = getDb();
    // ... DB 조회
    return successResponse(data);
  } catch (error) {
    return errorResponse(error);
  }
}
```

### getBoardAuth vs withAdminAuth
| 함수 | 용도 | 반환 |
|------|------|------|
| `withAdminAuth` | 관리자 전용 API 래퍼 | `adminAuth.discordId`, `adminAuth.userId` |
| `getBoardAuth` | 일반 사용자 API 함수 | `{ memberId, discordId, isAdmin }` 또는 `null` |

### API 표준 응답 (`api-error.ts`)
| 함수 | 용도 |
|------|------|
| `successResponse(data, message?)` | `{ success: true, data, message }` |
| `errorResponse(error)` | ApiError → 표준 에러 응답, unknown → 500 |
| `Errors.unauthorized()` | 401 |
| `Errors.forbidden(msg)` | 403 |
| `Errors.notFound(msg)` | 404 |
| `Errors.badRequest(msg)` | 400 |
| `withCache(response, maxAge, scope?)` | Cache-Control 헤더 설정 (`private` 기본) |

## Cache-Control 패턴

```ts
import { withCache, successResponse } from '@/lib/api-error';

// 읽기 전용 API에 캐시 적용
return withCache(successResponse(data), 60);           // private, 60s, swr 120s
return withCache(successResponse(data), 30, 'public'); // public, 30s, swr 60s
```

| API | maxAge | scope |
|-----|--------|-------|
| `GET /api/members` | 60s | private |
| `GET /api/members/[id]` | 60s | private |
| `GET /api/ranking` | 30s | private |

## 입력 새니타이즈 패턴

```ts
import { sanitizeDescription, sanitizeTiptapContent } from '@/lib/sanitize';

// description 필드: 제어 문자 + 제로 너비 유니코드 제거, 300자 제한
const desc = sanitizeDescription(input);

// Tiptap JSON content: javascript:/data:/vbscript: 프로토콜 링크 제거
const safeContent = sanitizeTiptapContent(content);
```

**적용 위치**: `api/board/route.ts` (POST), `api/board/[id]/route.ts` (PATCH)

## SSRF 방어 패턴

```ts
import { isSafeUrl } from '@/lib/rss-detect';

// 외부 URL fetch 전 반드시 체크
if (!isSafeUrl(url)) {
  return Errors.badRequest('허용되지 않은 URL입니다.').toResponse();
}
```

**적용 위치**: `api/posts/manual/route.ts`, `api/admin/curation/crawl/route.ts`

## 토스트 패턴

```tsx
import { toast } from 'sonner';

// 성공/에러 피드백 (inline 상태 관리 금지)
toast.success('저장되었습니다.');
toast.error('오류가 발생했습니다.');
```

`<Toaster />` 는 root `layout.tsx`에 설정됨 (`position="bottom-center"`, `richColors`)

## 공지 배너 패턴

게시판 공지 글 중 1개를 전역 배너로 표시. 관리자만 설정 가능.

### API: `GET /api/notice-banner`
- 인증 필수 (`getBoardAuth`)
- `isNoticeBanner: true` + `isPinned: true` + `deletedAt IS NULL`인 글 1개 반환
- `title`, `contentText`, `memberName` 포함
- `Cache-Control: no-store` (새 공지 즉시 반영)

### 배너 활성화 로직 (POST/PATCH)
- `isNoticeBanner` 설정 시 기존 배너 자동 비활성화 (트랜잭션)
- 관리자 전용: `category === 'notice'` 또는 `isNoticeBanner` 설정 시 `auth.isAdmin` 필수

```ts
// 트랜잭션 패턴 (배너 clear + set 원자적 처리)
const [result] = await database.transaction(async (tx) => {
  if (bannerEnabled) {
    await tx.update(boardPosts).set({ isNoticeBanner: false }).where(eq(boardPosts.isNoticeBanner, true));
  }
  return tx.insert(boardPosts).values({ ... }).returning();
});
```

### 클라이언트 (`NoticeBanner` 컴포넌트)
- localStorage로 상태 유지 (공지 ID별, 새 공지 시 자동 리셋)
- 상태: `open` (제목+내용 미리보기) → `collapsed` (제목만) → `closed` (숨김)
- 관리자 페이지에서는 미표시 (`{!isAdmin && <NoticeBanner />}`)

### Tiptap 에디터 한글 IME 대응

```ts
// compositionstart/end로 IME 조합 중 onUpdate 차단
editorProps: {
  handleDOMEvents: {
    compositionstart: () => { composingRef.current = true; return false; },
    compositionend: (_view) => {
      composingRef.current = false;
      requestAnimationFrame(() => onChange(...));
      return false;
    },
  },
},
```

## 카테고리 서버사이드 검증

```ts
import { isValidCategory } from '@/lib/board-config';
if (!isValidCategory(category)) {
  return Errors.badRequest('유효하지 않은 카테고리입니다.').toResponse();
}
```

## MemberAvatar 재사용 컴포넌트

프로필 아바타 + 이름 + 멤버 상세 링크 + 관리자 뱃지를 통합 제공:

```tsx
import { MemberAvatar } from '@/components/ui/member-avatar';

// 기본: 아바타만 (클릭 시 멤버 상세로 이동)
<MemberAvatar memberId={id} name={name} seed={discordId} imageUrl={profileImage} size="md" />

// 아바타 + 이름 + 관리자 뱃지
<MemberAvatar memberId={id} name={name} showName isAdmin={isAdmin} />

// 링크 비활성화 (삭제된 댓글 등)
<MemberAvatar name="익명" noLink />
```

| Prop | 타입 | 설명 |
|------|------|------|
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | 아바타 크기 |
| `showName` | boolean | 이름 표시 + 링크 포함 |
| `noLink` | boolean | 링크 비활성화 |
| `isAdmin` | boolean | 관리자 뱃지 표시 |

## 봇 작업 프록시 패턴

웹 관리자 대시보드에서 봇 스케줄러를 수동 트리거하는 프록시 API:

```
[Web Admin UI] → POST /api/admin/bot-operations/{operationId}
  → withAdminAuth (관리자 인증)
  → fetch(BOT_API_URL + endpoint, { signal: AbortController(30s) })
  → [Bot Express API :3001] → /api/trigger/{operationId}
  → rate limit (10/min) → isRunning guard → 작업 실행
```

### 봇 API 서버 (`api-server.ts`)

```ts
// Express 서버 (포트 3001), 각 스케줄러에 대한 POST 트리거 엔드포인트
// rate limit: 10 requests/min per endpoint
// 각 핸들러는 isRunning/isSending 가드로 중복 실행 방지
// 응답: { success, message, data? } 또는 409 (이미 실행 중)
```

### 웹 프록시 라우트 (`[operationId]/route.ts`)

```ts
// OPERATION_ENDPOINT_MAP으로 operationId → bot endpoint 매핑
// AbortController 30초 타임아웃
// 에러 분류: AbortError(타임아웃), ECONNREFUSED(봇 미실행), 409(중복 실행), 기타
```

### 지원 작업 목록

| operationId | 설명 | 스케줄 |
|-------------|------|--------|
| `rss-poll` | RSS 피드 수집 | 매 30분 |
| `attendance-check` | 출석 체크 | 회차 종료 후 |
| `fine-reminder` | 미납 벌금 알림 | 매일 |
| `round-report` | 회차 리포트 | 회차 종료 후 |
| `round-start` | 회차 시작 알림 | 회차 시작일 |
| `curation-crawl` | 큐레이션 크롤링 | 매일 09:00 |
| `curation-share` | 큐레이션 공유 | 매일 10:05 |
| `weekly-ranking` | 주간 랭킹 | 매주 일요일 22:00 |
