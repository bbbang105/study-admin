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
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { withAdminAuth } from '@/lib/admin';

const { members, MemberStatus } = sharedDb;

// GET — 목록 조회
export const GET = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const { searchParams } = new URL(request.url);
    const database = db();
    const result = await database.select().from(members);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ message: '서버 오류' }, { status: 500 });
  }
});

// POST — 생성
export const POST = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const body = await request.json();
    // validation → insert → returning
    return NextResponse.json({ message: '성공', data: newItem });
  } catch (error) {
    return NextResponse.json({ message: '서버 오류' }, { status: 500 });
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

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const discordId = user.identities?.find(i => i.provider === 'discord')?.id;
  // discordId로 members 테이블 조회
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
