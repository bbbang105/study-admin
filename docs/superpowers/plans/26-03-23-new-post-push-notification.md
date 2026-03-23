# 새 글 등록 푸시 알림 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 글 등록(수동 + RSS) 시 작성자 본인을 제외한 전원(active/OB/dormant)에게 FCM 푸시 알림 발송

**Architecture:** shared 스키마에 `new_post` 알림 타입 추가 → 웹에 내부 API 엔드포인트 생성 (봇→웹 통신용) → 수동 등록은 직접 `sendPushToMembers` 호출, RSS는 봇이 내부 API 호출 → 알림 설정 UI에 토글 추가

**Tech Stack:** Next.js (API route, `after()`), Drizzle ORM, FCM (`sendPushToMembers`), discord.js (봇)

**Spec:** `docs/superpowers/specs/26-03-23-new-post-push-notification-design.md`

---

## File Structure

| 파일 | 역할 | 변경 |
|------|------|------|
| `packages/shared/src/db/schema.ts` | NotificationType enum | `NEW_POST` 추가 |
| `packages/web/src/lib/sanitize.ts` | 새니타이즈 유틸 | `decodeHtmlEntities()` 추가 |
| `packages/web/src/app/api/internal/new-post-push/route.ts` | 내부 푸시 API | 신규 생성 |
| `packages/web/src/app/api/posts/manual/route.ts` | 수동 등록 | 별도 `after()` 블록 추가 |
| `packages/bot/src/scheduler-registry.ts` | RSS 수집 | 웹 내부 API 호출 추가 |
| `packages/web/src/components/settings/push-notification-settings.tsx` | 알림 설정 UI | `new_post` 토글 추가 |
| `packages/web/src/app/api/push/test/route.ts` | 테스트 푸시 | `new_post` 메시지 추가 |
| `.env.example` | 환경변수 문서 | `INTERNAL_API_KEY`, `WEB_URL` 추가 |

---

### Task 1: shared 스키마에 NotificationType 추가

**Files:**
- Modify: `packages/shared/src/db/schema.ts:524-530`

- [ ] **Step 1: `NotificationType`에 `NEW_POST` 추가**

```typescript
// packages/shared/src/db/schema.ts (line 524-530)
export const NotificationType = {
  BOARD_COMMENT: 'board_comment',
  BOARD_REPLY: 'board_reply',
  POST_COMMENT: 'post_comment',
  POST_REPLY: 'post_reply',
  BOARD_NOTICE: 'board_notice',
  NEW_POST: 'new_post',
} as const;
```

- [ ] **Step 2: shared 패키지 리빌드**

Run: `pnpm --filter @blog-study/shared build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add packages/shared/src/db/schema.ts
git commit -m "feat(shared): NotificationType에 NEW_POST 추가"
```

---

### Task 2: HTML 엔티티 디코더 추가

**Files:**
- Modify: `packages/web/src/lib/sanitize.ts`

- [ ] **Step 1: `decodeHtmlEntities()` 함수 추가**

`sanitize.ts` 파일 끝에 추가:

```typescript
/**
 * HTML 엔티티를 일반 문자로 디코딩 (RSS 제목에 사용)
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/web/src/lib/sanitize.ts
git commit -m "feat(web): HTML 엔티티 디코더 추가 (decodeHtmlEntities)"
```

---

### Task 3: 내부 푸시 API 엔드포인트 생성

**Files:**
- Create: `packages/web/src/app/api/internal/new-post-push/route.ts`

- [ ] **Step 1: API 라우트 생성**

```typescript
import { NextRequest } from 'next/server';
import { inArray, ne, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { sendPushToMembers } from '@/lib/push';
import { decodeHtmlEntities } from '@/lib/sanitize';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { members, MemberStatus } = sharedDb;

export async function POST(request: NextRequest) {
  try {
    // 내부 API 인증
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      return Errors.unauthorized('Invalid API key').toResponse();
    }

    const body = await request.json();
    const { postId, authorMemberId, authorName, postTitle } = body;

    if (!postId || !authorMemberId || !authorName || !postTitle) {
      return Errors.badRequest('postId, authorMemberId, authorName, postTitle은 필수입니다.').toResponse();
    }

    const database = getDb();

    // active + OB + dormant 멤버 조회 (작성자 제외)
    const targetMembers = await database
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          inArray(members.status, [MemberStatus.ACTIVE, MemberStatus.OB, MemberStatus.DORMANT]),
          ne(members.id, authorMemberId)
        )
      );

    if (targetMembers.length === 0) {
      return successResponse({ success: 0, failed: 0 }, '발송 대상 없음');
    }

    const safeTitle = decodeHtmlEntities(postTitle).slice(0, 100);

    const result = await sendPushToMembers(
      targetMembers.map((m) => m.id),
      {
        title: '📝 새 글이 등록되었어요',
        body: `${authorName}님이 새 글을 등록했어요: ${safeTitle}`,
        clickUrl: `/posts/${postId}`,
        data: { type: 'new_post' },
      }
    );

    return successResponse(result);
  } catch (error) {
    console.error('[internal/new-post-push] Error:', error);
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/web/src/app/api/internal/new-post-push/route.ts
git commit -m "feat(web): 새 글 푸시 알림 내부 API 엔드포인트 추가"
```

---

### Task 4: 수동 등록에 푸시 알림 추가

**Files:**
- Modify: `packages/web/src/app/api/posts/manual/route.ts`

- [ ] **Step 1: import 추가**

기존 import 블록에 추가:

```typescript
import { sendPushToMembers } from '@/lib/push';
import { inArray } from 'drizzle-orm';
```

참고: `eq`, `and`, `sql`은 이미 import됨. `inArray`만 추가 필요.

- [ ] **Step 2: Discord `after()` 블록 뒤에 별도 푸시 `after()` 블록 추가**

기존 코드 (line 354) `});` (Discord after 블록 종료) 이후, `return successResponse(...)` (line 356) 이전에 추가:

```typescript
    // 푸시 알림 (Discord 토글과 무관하게 항상 발송)
    if (newPost) {
      after(async () => {
        try {
          const database3 = db();
          const allMembers = await database3
            .select({ id: members.id })
            .from(members)
            .where(inArray(members.status, ['active', 'ob', 'dormant']));

          const targetIds = allMembers
            .map((m) => m.id)
            .filter((id) => id !== member.id);

          if (targetIds.length > 0) {
            await sendPushToMembers(targetIds, {
              title: '📝 새 글이 등록되었어요',
              body: `${member.name}님이 새 글을 등록했어요: ${title!.slice(0, 100)}`,
              clickUrl: `/posts/${newPost!.id}`,
              data: { type: 'new_post' },
            });
          }
        } catch (e) {
          console.error('[manual-post] 푸시 알림 전송 실패:', e);
        }
      });
    }
```

- [ ] **Step 3: 타입 체크**

Run: `pnpm typecheck`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add packages/web/src/app/api/posts/manual/route.ts
git commit -m "feat(web): 수동 포스트 등록 시 푸시 알림 발송"
```

---

### Task 5: RSS 수집에 푸시 알림 호출 추가

**Files:**
- Modify: `packages/bot/src/scheduler-registry.ts`

- [ ] **Step 1: RSS 콜백에서 `sendPostNotification` 호출 뒤에 푸시 API 호출 추가**

기존 코드 (line ~137, `notificationService.sendPostNotification(...)` 이후)에 추가:

```typescript
      // 푸시 알림 (웹 내부 API 호출)
      try {
        const webUrl = process.env.WEB_URL;
        const apiKey = process.env.INTERNAL_API_KEY;
        if (webUrl && apiKey) {
          const pushRes = await fetch(`${webUrl}/api/internal/new-post-push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              postId: result.post.id,
              authorMemberId: member.id,
              authorName: member.name,
              postTitle: item.title,
            }),
          });
          if (!pushRes.ok) {
            logger.warn({ status: pushRes.status }, '📢 [알림] 푸시 알림 API 응답 실패');
          }
        }
      } catch (e) {
        logger.error({ error: e }, '📢 [알림] 푸시 알림 전송 실패');
      }
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm typecheck`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add packages/bot/src/scheduler-registry.ts
git commit -m "feat(bot): RSS 새 글 감지 시 웹 푸시 알림 API 호출"
```

---

### Task 6: 알림 설정 UI에 토글 추가

**Files:**
- Modify: `packages/web/src/components/settings/push-notification-settings.tsx`

- [ ] **Step 1: `FileText` import 추가**

기존 import (line 4):
```typescript
import { Bell, Megaphone, MessageCircle, MessageSquare, SendHorizonal } from 'lucide-react';
```
변경:
```typescript
import { Bell, FileText, Megaphone, MessageCircle, MessageSquare, SendHorizonal } from 'lucide-react';
```

- [ ] **Step 2: `NOTIFICATION_LABELS`에 `new_post` 추가**

기존 `board_notice` 항목 (line 41) 뒤에 추가:

```typescript
  new_post: {
    label: '새 글 알림',
    icon: FileText,
    description: '스터디원이 새 글을 등록할 때',
  },
```

- [ ] **Step 3: 커밋**

```bash
git add packages/web/src/components/settings/push-notification-settings.tsx
git commit -m "feat(web): 알림 설정에 새 글 알림 토글 추가"
```

---

### Task 7: 테스트 푸시 메시지 추가

**Files:**
- Modify: `packages/web/src/app/api/push/test/route.ts`

- [ ] **Step 1: `TEST_MESSAGES`에 `new_post` 추가**

기존 `board_notice` 항목 (line 26) 뒤에 추가:

```typescript
  new_post: {
    title: '📝 새 글 알림 테스트',
    body: '스터디원이 새 글을 등록했습니다.',
  },
```

- [ ] **Step 2: 커밋**

```bash
git add packages/web/src/app/api/push/test/route.ts
git commit -m "feat(web): 테스트 푸시에 새 글 알림 타입 추가"
```

---

### Task 8: 환경변수 문서화 + 빌드 검증

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: `.env.example`에 새 환경변수 추가**

파일 끝에 추가:

```
# Internal API (bot → web push notification)
INTERNAL_API_KEY=
WEB_URL=
```

- [ ] **Step 2: 전체 빌드 검증**

Run: `pnpm build`
Expected: shared, bot, web 모두 빌드 성공

- [ ] **Step 3: 전체 린트 + 타입 체크**

Run: `pnpm lint && pnpm typecheck`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add .env.example
git commit -m "docs: INTERNAL_API_KEY, WEB_URL 환경변수 추가"
```
