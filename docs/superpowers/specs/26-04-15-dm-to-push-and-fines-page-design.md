# Discord DM → FCM 푸시 전환 + 벌금 상세 페이지

## 개요

Discord DM으로 보내던 개인 알림(벌금, 마감, 투표 리마인더 등)을 FCM 푸시 알림으로 전환한다.
이에 따라 벌금 "납부 완료" 버튼을 웹으로 옮기기 위해 벌금 상세 페이지를 신규 개발한다.

## 변경 범위

1. **벌금 상세 페이지** — `/profile/fines` 신규
2. **내부 API** — `POST /api/internal/reminder-push` 신규
3. **봇 DM → 푸시 전환** — 5종 DM 발송 로직을 내부 API 호출로 교체
4. **NotificationType 확장** — 5종 추가 + 알림 설정 UI 반영
5. **알림 로그 대상 확장** — `push` 대상 추가

---

## 1. 벌금 상세 페이지

### 경로

`/profile/fines` (`packages/web/src/app/(user)/profile/fines/page.tsx`)

### 진입점

- 프로필 "미납 벌금" 스탯 카드 클릭
- 푸시 알림 딥링크 (`clickUrl: '/profile/fines'`)

### 레이아웃 (단일 리스트)

```
┌─────────────────────────────────────────┐
│ Profile / Fines                         │
│ 벌금 내역                         ← 뒤로 │
├─────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ 미납      │ │ 납부완료  │ │ 총 벌금   │ │
│ │ 3,000원   │ │ 6,000원  │ │ 9,000원  │ │
│ │ (빨강)    │ │ (초록)   │ │          │ │
│ └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────┤
│ 미납 벌금                               │
│ ┌─────────────────────────────────────┐ │
│ │ 5회차 · 지각         3,000원 (빨강) │ │
│ │ 2026.04.14           [납부 완료]    │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 납부 / 면제                             │
│ ┌─────────────────────────────────────┐ │
│ │ 4회차 · 결석  (취소선) 3,000원      │ │
│ │ 2026.04.07            납부완료 뱃지 │ │
│ ├─────────────────────────────────────┤ │
│ │ 3회차 · 지각  (취소선) 3,000원      │ │
│ │ 2026.03.31            면제 뱃지     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│         입금 계좌: 3333333114501        │
│              카카오뱅크                  │
└─────────────────────────────────────────┘
```

### 납부 완료 플로우

1. "납부 완료" 버튼 클릭
2. 확인 다이얼로그 표시 ("정말 납부 완료 처리하시겠습니까?")
3. `PATCH /api/fines/[id]/pay` 호출
4. 서버: `status = PAID`, `paidAt = now()`, `pendingConfirmation = false`
5. 서버: 관리자 Discord 채널에 납부 완료 알림 (`discord-notify.ts`)
6. 클라이언트: 토스트 ("납부가 확인되었습니다") + 목록 갱신

### API

**`GET /api/profile/fines`** — 내 벌금 목록 조회

- 인증: Supabase Auth → Discord ID → member
- 응답: `{ fines: Fine[], summary: { unpaid, paid, total } }`
- Fine: `{ id, roundNumber, type, amount, status, createdAt, paidAt }`
- 정렬: 미납 먼저 (createdAt DESC), 그 다음 납부/면제 (createdAt DESC)

**`PATCH /api/fines/[id]/pay`** — 납부 완료 처리

- 인증: Supabase Auth → 본인 벌금인지 검증
- 검증: status가 PENDING(UNPAID)인 경우만 허용
- 처리: status=PAID, paidAt=now(), pendingConfirmation=false
- 사이드이펙트: `after()`로 관리자 Discord 채널 알림 발송
- 응답: `{ fine: Fine }`

---

## 2. 내부 API (`POST /api/internal/reminder-push`)

기존 `POST /api/internal/new-post-push` 패턴을 범용화한다.

### 스펙

- **인증**: `Authorization: Bearer {INTERNAL_API_KEY}` (timing-safe comparison)
- **Rate limit**: 30 requests/minute
- **Body**:
  ```ts
  {
    type: string;           // NotificationType (fine_notification, deadline_reminder, ...)
    memberIds: string[];    // 대상 멤버 ID 배열
    title: string;          // 푸시 제목
    body: string;           // 푸시 본문
    clickUrl: string;       // 클릭 시 이동 URL
  }
  ```
- **처리**: `sendPushToMembers(memberIds, { title, body, clickUrl, data: { type } })`
- **응답**: `{ success: number, failed: number }`

### 검증

- `type`: NotificationType enum에 포함된 값인지
- `memberIds`: 1개 이상, 각각 UUID 형식
- `title`, `body`: string, 최대 200자 / 1000자
- `clickUrl`: `/`로 시작하는 상대 경로

---

## 3. 봇 DM → 푸시 전환

### 전환 대상

| # | 기존 DM 함수 | 푸시 type | title | body 템플릿 | clickUrl |
|---|-------------|-----------|-------|------------|----------|
| 1 | `sendFineNotification()` | `fine_notification` | "벌금이 부과되었어요" | "{round}회차 {reason} 벌금 {amount}원이 부과되었습니다." | `/profile/fines` |
| 2 | `sendFineReminder()` | `fine_reminder` | "미납 벌금 리마인더" | "{round}회차 {reason} 벌금이 {days}일째 미납 상태입니다." | `/profile/fines` |
| 3 | `sendGracePeriodNudge()` | `grace_nudge` | "아직 시간이 있어요!" | "오늘 안에 제출하면 결석은 피할 수 있어요." | `/dashboard` |
| 4 | `DeadlineReminder.sendForDDay()` | `deadline_reminder` | D-day별 메시지 타이틀 | D-day별 메시지 본문 (기존 문구 유지) | `/dashboard` |
| 5 | `sendPollReminderDM()` | `poll_reminder` | "투표에 참여해주세요" | '"{question}" 투표가 곧 마감됩니다!' | `/board/{postId}` |

### 봇 변경사항

**신규**: `packages/bot/src/lib/push-client.ts`
- `sendReminderPush(payload)` — 웹 내부 API 호출 래퍼
- `WEB_URL + '/api/internal/reminder-push'` + Bearer 인증
- 실패 시 로그만 남기고 에러 throw하지 않음

**수정**: 각 스케줄러/핸들러
- `dm-handler.ts`: `sendFineNotification()`, `sendFineReminder()`, `sendPollReminderDM()` → 내부에서 `user.send()` 대신 `sendReminderPush()` 호출
- `fine-reminder.ts`: `sendGracePeriodNudge()` → `sendReminderPush()` 호출
- `deadline-reminder.ts`: `sendForDDay()` → `sendReminderPush()` 호출

**유지**: `setupDMHandler()` + 버튼 인터랙션 핸들러
- 이미 발송된 Discord DM의 "납부 완료" 버튼 클릭은 계속 처리
- 신규 벌금 납부는 웹 `/profile/fines`에서만 가능

### 알림 로그

- 봇의 기존 `logNotification()` 호출은 **제거** (DM을 더 이상 보내지 않으므로)
- 웹 내부 API에서 푸시 발송 후 로그 기록 (source: `'web'`, target: `'push'`)
- 이중 로깅 방지: 알림 하나당 로그 한 건 (웹 API가 담당)

---

## 4. NotificationType 확장

### schema.ts 변경

```ts
export const NotificationType = {
  BOARD_COMMENT: 'board_comment',
  BOARD_REPLY: 'board_reply',
  POST_COMMENT: 'post_comment',
  POST_REPLY: 'post_reply',
  BOARD_NOTICE: 'board_notice',
  NEW_POST: 'new_post',
  // 신규 추가
  FINE_NOTIFICATION: 'fine_notification',
  FINE_REMINDER: 'fine_reminder',
  DEADLINE_REMINDER: 'deadline_reminder',
  GRACE_NUDGE: 'grace_nudge',
  POLL_REMINDER: 'poll_reminder',
} as const;
```

### 알림 설정 UI 확장

`push-notification-settings.tsx`의 `NOTIFICATION_LABELS`에 추가:

| type | label | description |
|------|-------|-------------|
| `fine_notification` | 벌금 알림 | 벌금이 부과될 때 |
| `fine_reminder` | 벌금 리마인더 | 미납 벌금 독촉 |
| `deadline_reminder` | 마감 리마인더 | 제출 마감 D-2/D-1/D-day |
| `grace_nudge` | 지각 독촉 | 지각 기간 제출 독려 |
| `poll_reminder` | 투표 리마인더 | 투표 마감 전 참여 요청 |

---

## 5. 알림 로그 대상 확장

### notification-log-config.ts 변경

`isDM: boolean` → `target: 'channel' | 'dm' | 'push'`로 확장.

```ts
export interface NotificationLogTypeMeta {
  label: string;
  color: string;
  target: 'channel' | 'dm' | 'push';
}
```

기존 `isDM: true` → `target: 'dm'`, `isDM: false` → `target: 'channel'`.
새 푸시 알림 타입은 `target: 'push'`.

### 관리자 UI 필터

대상 필터 옵션: `전체` / `채널` / `DM` / `푸시`

---

## 스코프 외

- 기존 Discord 채널 알림(새 글, 인기 포스트, 회차 리포트 등)은 변경하지 않음
- `setupDMHandler()`의 버튼 인터랙션은 레거시 호환용으로 유지
- Vercel Cron으로의 스케줄러 이전은 이번 스코프에 포함하지 않음
