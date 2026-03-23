# 새 글 등록 푸시 알림

새 글이 등록(수동 + RSS)되면, 알림을 허용한 멤버 전원에게 FCM 푸시 알림을 발송한다. 작성자 본인은 제외.

## 설계 결정

- **푸시 대상**: active + OB + dormant 전원 (작성자 본인 제외). `new_post` 알림 설정이 꺼져 있으면 제외 (기존 `sendPushToMembers` 로직).
- **Discord 토글과 독립**: 수동 등록 시 `notifyDiscord` 토글과 무관하게 푸시는 항상 발송. 별도 `after()` 블록으로 분리.
- **인앱 알림 기록 없음**: FCM 푸시만 발송, DB에 알림 레코드 저장하지 않음.
- **배포 원자성**: shared `NotificationType` 추가 + 웹 UI 라벨은 동시 배포 필수 (라벨 없으면 raw string 노출).

## 변경 포인트

### 1. NotificationType 추가 (shared)

`packages/shared/src/db/schema.ts`의 `NotificationType`에 추가:

```ts
NEW_POST: 'new_post',
```

DB 마이그레이션 불필요 — `notification_preferences.type`은 `varchar(30)`이고, 새 타입은 레코드가 없으면 기본값 `true`로 처리됨 (기존 GET API 로직).

### 2. 내부 API 엔드포인트

`POST /api/internal/new-post-push`

**인증**: `Authorization: Bearer {INTERNAL_API_KEY}` 헤더. 환경변수 `INTERNAL_API_KEY`를 봇과 웹이 공유.

**Request body**:
```json
{
  "postId": "uuid",
  "authorMemberId": "uuid",
  "authorName": "닉네임",
  "postTitle": "포스트 제목"
}
```

**로직**:
1. `members` 테이블에서 active + OB + dormant 멤버 ID 목록 조회
2. `authorMemberId` 제외
3. `postTitle` 새니타이즈 — HTML 엔티티 제거 (`&amp;` → `&` 등). RSS 경유 시 인코딩된 제목이 올 수 있음
4. `sendPushToMembers(memberIds, payload)` 호출
   - `payload.data.type = 'new_post'` → 알림 선호도 자동 필터링 (기존 로직)
   - `title`: `📝 새 글이 등록되었어요`
   - `body`: `{authorName}님이 새 글을 등록했어요: {postTitle}` (postTitle 100자 제한)
   - `clickUrl`: `/posts/{postId}`

**실패 처리**: `WEB_URL` 또는 `INTERNAL_API_KEY` 미설정 시 fetch 실패 → catch에서 로그만 남기고 RSS 파이프라인은 정상 진행.

**Response**: `{ success: true, data: { success: N, failed: N } }`

### 3. 수동 등록에서 호출 (web)

`packages/web/src/app/api/posts/manual/route.ts`

기존 Discord 알림 `after()` 블록과 **별도 `after()` 블록**에서 `sendPushToMembers()` 호출. `shouldNotify` 플래그와 무관하게 항상 실행.

```ts
// Discord 알림 after() 블록 바깥, newPost가 있을 때
if (newPost) {
  after(async () => {
    try {
      const database3 = db();
      const allMembers = await database3
        .select({ id: members.id })
        .from(members)
        .where(inArray(members.status, ['active', 'ob', 'dormant']));

      const targetIds = allMembers
        .map(m => m.id)
        .filter(id => id !== member.id);

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

### 4. RSS 수집에서 호출 (bot → web API)

`packages/bot/src/scheduler-registry.ts`

RSS로 새 포스트 감지 후, `result.isNew`일 때 웹 내부 API 호출:

```ts
if (result.isNew) {
  // 기존 Discord 알림
  await notificationService.sendPostNotification(...);

  // 푸시 알림 (웹 내부 API 호출)
  try {
    const webUrl = process.env.WEB_URL;
    const apiKey = process.env.INTERNAL_API_KEY;
    if (webUrl && apiKey) {
      await fetch(`${webUrl}/api/internal/new-post-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          postId: result.post.id,
          authorMemberId: result.post.memberId,
          authorName: member.name,
          postTitle: result.post.title,
        }),
      });
    }
  } catch (e) {
    logger.error({ error: e }, '푸시 알림 전송 실패');
  }
}
```

### 5. 알림 설정 UI

`packages/web/src/components/settings/push-notification-settings.tsx`의 `NOTIFICATION_LABELS`에 추가:

```ts
new_post: {
  label: '새 글 알림',
  icon: FileText,
  description: '스터디원이 새 글을 등록할 때',
},
```

### 6. 테스트 푸시

`packages/web/src/app/api/push/test/route.ts`의 `TEST_MESSAGES`에 추가:

```ts
new_post: {
  title: '📝 새 글 알림 테스트',
  body: '스터디원이 새 글을 등록했습니다.',
},
```

### 7. 환경변수

| 변수 | 위치 | 용도 |
|------|------|------|
| `INTERNAL_API_KEY` | 웹 `.env.local` + 봇 `.env.local` | 내부 API 인증 |
| `WEB_URL` | 봇 `.env.local` | 웹 서버 주소 (예: `https://kusting-web.vercel.app`) |

`.env.example`에도 추가 필요.

### 8. shared 패키지 리빌드

`NotificationType` 변경 후 `pnpm --filter @blog-study/shared build` 필수.

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `packages/shared/src/db/schema.ts` | `NotificationType`에 `NEW_POST` 추가 |
| `packages/web/src/app/api/internal/new-post-push/route.ts` | 신규: 내부 푸시 API |
| `packages/web/src/app/api/posts/manual/route.ts` | 별도 `after()` 블록에 `sendPushToMembers` 추가 |
| `packages/bot/src/scheduler-registry.ts` | RSS 새 글 시 웹 내부 API 호출 추가 |
| `packages/web/src/components/settings/push-notification-settings.tsx` | `new_post` 토글 + `FileText` import 추가 |
| `packages/web/src/app/api/push/test/route.ts` | `new_post` 테스트 메시지 추가 |
| `.env.example` | `INTERNAL_API_KEY`, `WEB_URL` 추가 |
