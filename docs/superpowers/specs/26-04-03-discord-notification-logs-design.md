# Discord 알림 로그 시스템 설계

## 목적

봇/웹에서 Discord 채널 및 DM으로 보내는 알림의 성공/실패를 DB에 기록하고, 관리자 페이지에서 조회할 수 있게 한다. RSS 수집은 제외.

## DB 스키마

### 테이블: `discord_notification_logs`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID (PK, default gen) | |
| `source` | VARCHAR(10) NOT NULL | `'bot'` / `'web'` |
| `type` | VARCHAR(50) NOT NULL | 알림 타입 (아래 참조) |
| `channel_id` | VARCHAR(20) | Discord 채널 ID (DM은 null) |
| `channel_name` | VARCHAR(100) | 채널 이름 (DM은 대상 닉네임) |
| `target_discord_id` | VARCHAR(20) | DM 대상 Discord ID (채널 알림은 null) |
| `message_id` | VARCHAR(20) | Discord 메시지 ID (성공 시) |
| `summary` | VARCHAR(500) | 메시지 요약 (한줄) |
| `metadata` | JSONB DEFAULT '{}' | 타입별 추가 데이터 |
| `status` | VARCHAR(10) DEFAULT 'sent' | `'sent'` / `'failed'` |
| `error_message` | TEXT | 실패 시 에러 메시지 |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |

인덱스: `(created_at DESC)`, `(type)`, `(status)`, `(target_discord_id)`

### 알림 타입

| source | type | 한글 라벨 | 칩 색상 | 대상 | 설명 |
|--------|------|-----------|---------|------|------|
| `bot` | `round_report` | 회차 리포트 | indigo | 채널 | 회차 종료 리포트 |
| `bot` | `round_start` | 회차 시작 | blue | 채널 | 새 회차 시작 공지 |
| `bot` | `weekly_ranking` | 주간 랭킹 | amber | 채널 | 주간 랭킹 발표 |
| `bot` | `curation` | 큐레이션 | purple | 채널 | 일일 큐레이션 공유 |
| `bot` | `new_post` | 새 글 알림 | green | 채널 | 새 블로그 글 알림 |
| `bot` | `fine_payment` | 벌금 확인 | red | 채널 | 벌금 납부 확인 |
| `bot` | `deadline_reminder` | 마감 리마인더 | rose | DM | D-2/D-1/D-Day 마감 알림 |
| `bot` | `fine_notification` | 벌금 알림 | red | DM | 벌금 부과 DM |
| `bot` | `fine_reminder` | 벌금 독촉 | orange | DM | 미납 벌금 리마인더 DM |
| `bot` | `grace_nudge` | 지각 독촉 | yellow | DM | 지각 기간 제출 독촉 DM |
| `bot` | `poll_reminder` | 투표 리마인더 | cyan | DM | 투표 미참여 리마인더 DM |
| `web` | `board_notice` | 게시판 공지 | sky | 채널 | 게시판 공지 → Discord |
| `web` | `post_register` | 수동 등록 | emerald | 채널 | 포스트 수동등록 알림 |
| `web` | `member_approval` | 가입 승인 | teal | 채널 | 가입 승인대기 알림 |
| `web` | `announcement` | 공지 알림 | orange | 채널 | 공지사항 Discord 알림 |

## 봇 측 구현

### 공통 로깅 헬퍼

`packages/bot/src/lib/notification-logger.ts` 신규 파일:

```typescript
async function logNotification(params: {
  source: 'bot';
  type: string;
  channelId: string;
  channelName?: string;
  messageId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  status: 'sent' | 'failed';
  errorMessage?: string;
}): Promise<void>
```

- DB에 직접 insert (봇은 이미 DB 접근 가능)
- 로깅 실패 시 logger.warn만 남기고 본 로직에 영향 없음

### 삽입 지점

**채널 알림:**

| 파일 | 함수 | 삽입 위치 |
|------|------|-----------|
| `notification.service.ts` | `sendPostNotification` | channel.send() 후 |
| `notification.service.ts` | `sendRoundReport` | channel.send() 후 |
| `notification.service.ts` | `sendRoundStartAnnouncement` | channel.send() 후 |
| `weekly-ranking.ts` | `sendWeeklyRanking` | channel.send() 후 |
| `curation-crawler.ts` | `shareDailyContent` | channel.send() 후 |
| `dm-handler.ts` | fine_payment 확인 로그 | channel.send() 후 |

**DM 발송:**

| 파일 | 함수 | type |
|------|------|------|
| `dm-handler.ts` | `sendFineNotification` | `fine_notification` |
| `dm-handler.ts` | `sendFineReminder` | `fine_reminder` |
| `dm-handler.ts` | `sendPollReminderDM` | `poll_reminder` |
| `deadline-reminder.ts` | `sendForDDay` (user.send 루프) | `deadline_reminder` |
| `fine-reminder.ts` | `sendGracePeriodNudge` | `grace_nudge` |

## 웹 측 구현

### `discord-notify.ts` 수정

`sendDiscordChannelMessage` 함수에서:
1. 성공 시 response body에서 `message.id` 추출
2. 호출자에게 결과 반환 (현재 boolean → `{ success, messageId?, error? }`)
3. 호출 측에서 로그 insert (after() 사용)

**또는** 더 간단하게: 각 호출 지점에서 직접 로그 insert.

### 삽입 지점 (웹)

| 파일 | 상황 | type |
|------|------|------|
| `api/board/[id]/notices` 등 공지 관련 | 게시판 공지 | `board_notice` |
| `api/posts/register` | 포스트 수동등록 | `post_register` |
| 가입 승인 관련 API | 가입 승인대기 | `member_approval` |
| 공지 작성 관련 API | 공지사항 알림 | `announcement` |

## 관리자 UI

### 위치

기존 `bot-operations` 페이지에 **탭 추가**: `[수동 실행] [알림 로그]`

### 로그 리스트

- 최신순 정렬
- 무한 스크롤 (20개씩)
- 각 항목: 상태 도트(sent=green, failed=red) + 타입 한글 칩(색상별) + source 뱃지(bot/web) + 채널명 + summary + 상대시간
- 실패 시: 에러 메시지 빨간 텍스트 표시

### 필터

- **타입**: 전체 / 각 타입별 (한글 라벨로 표시)
- **소스**: 전체 / 봇 / 웹
- **대상**: 전체 / 채널 / DM
- **상태**: 전체 / 성공 / 실패

### API

`GET /api/admin/bot-logs`
- Query: `?type=&source=&status=&cursor=&limit=20`
- 관리자 인증 필수 (`withAdminAuth`)
- `withCache(response, 10)` (10초)

## 보존 정책

무제한 보존 (삭제 없음).

## 범위 외

- RSS 수집 로그 (제외)
- 메시지 전문 저장 (요약만 저장)
