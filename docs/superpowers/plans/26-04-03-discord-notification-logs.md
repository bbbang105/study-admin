# Discord 알림 로그 시스템 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 봇/웹에서 Discord 채널 및 DM으로 보내는 모든 알림의 성공/실패를 DB에 기록하고, 관리자 페이지에서 조회

**Architecture:** shared에 스키마 추가 → bot에 공통 로깅 헬퍼 생성 후 각 서비스에 삽입 → web의 discord-notify.ts 확장 → 관리자 API + UI

**Tech Stack:** Drizzle ORM, Next.js API Routes, React (shadcn/ui), discord.js

---

## File Structure

### 신규 파일
- `packages/shared/src/db/schema.ts` — 테이블 추가 (기존 파일 수정)
- `packages/bot/src/lib/notification-logger.ts` — 봇 알림 로그 헬퍼
- `packages/web/src/app/api/admin/bot-logs/route.ts` — 로그 조회 API
- `packages/web/src/lib/notification-log.ts` — 웹 알림 로그 헬퍼
- `packages/web/src/lib/notification-log-config.ts` — 타입 메타데이터 (라벨/색상)
- `packages/web/src/app/(admin)/admin/bot-operations/notification-logs.tsx` — 로그 탭 UI

### 수정 파일
- `packages/shared/src/db/schema.ts` — 테이블+타입 추가
- `packages/web/src/lib/discord-notify.ts` — 반환타입 확장 (messageId 포함)
- `packages/web/src/app/(admin)/admin/bot-operations/page.tsx` — 탭 추가
- `packages/bot/src/services/notification.service.ts` — 채널 알림 로깅 삽입
- `packages/bot/src/schedulers/weekly-ranking.ts` — 랭킹 로깅 삽입
- `packages/bot/src/schedulers/curation-crawler.ts` — 큐레이션 로깅 삽입
- `packages/bot/src/handlers/dm-handler.ts` — DM 로깅 삽입
- `packages/bot/src/schedulers/deadline-reminder.ts` — DM 로깅 삽입
- `packages/bot/src/schedulers/fine-reminder.ts` — DM 로깅 삽입
- `packages/web/src/app/api/board/route.ts` — 공지 알림 로깅 삽입
- `packages/web/src/app/api/posts/manual/route.ts` — 수동등록 알림 로깅 삽입

---

### Task 1: DB 스키마 추가

**Files:**
- Modify: `packages/shared/src/db/schema.ts` (끝부분, ~line 866 이후)

- [ ] **Step 1: 스키마에 discord_notification_logs 테이블 추가**

`packages/shared/src/db/schema.ts`의 마지막 type export 블록 직전에 추가:

```typescript
// ── Discord Notification Logs ─────────────────────────────────────────

export const discordNotificationLogs = pgTable(
  'discord_notification_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: varchar('source', { length: 10 }).notNull(), // 'bot' | 'web'
    type: varchar('type', { length: 50 }).notNull(),
    channelId: varchar('channel_id', { length: 20 }),
    channelName: varchar('channel_name', { length: 100 }),
    targetDiscordId: varchar('target_discord_id', { length: 20 }),
    messageId: varchar('message_id', { length: 20 }),
    summary: varchar('summary', { length: 500 }),
    metadata: jsonb('metadata').default({}),
    status: varchar('status', { length: 10 }).default('sent').notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index('idx_discord_notification_logs_created_at').on(table.createdAt),
    typeIdx: index('idx_discord_notification_logs_type').on(table.type),
    statusIdx: index('idx_discord_notification_logs_status').on(table.status),
    targetIdx: index('idx_discord_notification_logs_target').on(table.targetDiscordId),
  })
);
```

타입 export 블록에 추가:

```typescript
export type DiscordNotificationLog = typeof discordNotificationLogs.$inferSelect;
export type NewDiscordNotificationLog = typeof discordNotificationLogs.$inferInsert;
```

- [ ] **Step 2: shared 리빌드**

Run: `pnpm --filter @blog-study/shared build`

- [ ] **Step 3: Drizzle push**

```bash
cd packages/shared
export $(grep DATABASE_URL ../../.env.local | head -1 | xargs)
npx drizzle-kit push --force
```

- [ ] **Step 4: 타입체크**

Run: `pnpm typecheck`
Expected: 성공

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/src/db/schema.ts
git commit -m "feat(shared): add discord_notification_logs table schema"
```

---

### Task 2: 알림 타입 메타데이터 설정 (웹)

**Files:**
- Create: `packages/web/src/lib/notification-log-config.ts`

- [ ] **Step 1: 타입별 라벨/색상 설정 파일 생성**

```typescript
export const NotificationLogType = {
  // Bot - Channel
  ROUND_REPORT: 'round_report',
  ROUND_START: 'round_start',
  WEEKLY_RANKING: 'weekly_ranking',
  CURATION: 'curation',
  NEW_POST: 'new_post',
  FINE_PAYMENT: 'fine_payment',
  // Bot - DM
  DEADLINE_REMINDER: 'deadline_reminder',
  FINE_NOTIFICATION: 'fine_notification',
  FINE_REMINDER: 'fine_reminder',
  GRACE_NUDGE: 'grace_nudge',
  POLL_REMINDER: 'poll_reminder',
  // Web - Channel
  BOARD_NOTICE: 'board_notice',
  POST_REGISTER: 'post_register',
  MEMBER_APPROVAL: 'member_approval',
  ANNOUNCEMENT: 'announcement',
} as const;

export type NotificationLogTypeValue =
  (typeof NotificationLogType)[keyof typeof NotificationLogType];

export interface NotificationLogTypeMeta {
  label: string;
  color: string; // Tailwind badge class
  isDM: boolean;
}

export const notificationLogTypeConfig: Record<string, NotificationLogTypeMeta> = {
  // Bot - Channel
  [NotificationLogType.ROUND_REPORT]: {
    label: '회차 리포트',
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    isDM: false,
  },
  [NotificationLogType.ROUND_START]: {
    label: '회차 시작',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    isDM: false,
  },
  [NotificationLogType.WEEKLY_RANKING]: {
    label: '주간 랭킹',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    isDM: false,
  },
  [NotificationLogType.CURATION]: {
    label: '큐레이션',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    isDM: false,
  },
  [NotificationLogType.NEW_POST]: {
    label: '새 글 알림',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    isDM: false,
  },
  [NotificationLogType.FINE_PAYMENT]: {
    label: '벌금 확인',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    isDM: false,
  },
  // Bot - DM
  [NotificationLogType.DEADLINE_REMINDER]: {
    label: '마감 리마인더',
    color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
    isDM: true,
  },
  [NotificationLogType.FINE_NOTIFICATION]: {
    label: '벌금 알림',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    isDM: true,
  },
  [NotificationLogType.FINE_REMINDER]: {
    label: '벌금 독촉',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    isDM: true,
  },
  [NotificationLogType.GRACE_NUDGE]: {
    label: '지각 독촉',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    isDM: true,
  },
  [NotificationLogType.POLL_REMINDER]: {
    label: '투표 리마인더',
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    isDM: true,
  },
  // Web - Channel
  [NotificationLogType.BOARD_NOTICE]: {
    label: '게시판 공지',
    color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    isDM: false,
  },
  [NotificationLogType.POST_REGISTER]: {
    label: '수동 등록',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    isDM: false,
  },
  [NotificationLogType.MEMBER_APPROVAL]: {
    label: '가입 승인',
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
    isDM: false,
  },
  [NotificationLogType.ANNOUNCEMENT]: {
    label: '공지 알림',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    isDM: false,
  },
};

export function getLogTypeMeta(type: string): NotificationLogTypeMeta {
  return notificationLogTypeConfig[type] ?? {
    label: type,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    isDM: false,
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/web/src/lib/notification-log-config.ts
git commit -m "feat(web): add notification log type config with labels and colors"
```

---

### Task 3: 봇 알림 로그 헬퍼

**Files:**
- Create: `packages/bot/src/lib/notification-logger.ts`

- [ ] **Step 1: 로깅 헬퍼 생성**

```typescript
import { getDb, discordNotificationLogs } from '@blog-study/shared/db';
import { logger } from './logger';

interface LogNotificationParams {
  source: 'bot' | 'web';
  type: string;
  channelId?: string;
  channelName?: string;
  targetDiscordId?: string;
  messageId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  status: 'sent' | 'failed';
  errorMessage?: string;
}

export async function logNotification(params: LogNotificationParams): Promise<void> {
  try {
    const db = getDb();
    await db.insert(discordNotificationLogs).values({
      source: params.source,
      type: params.type,
      channelId: params.channelId ?? null,
      channelName: params.channelName ?? null,
      targetDiscordId: params.targetDiscordId ?? null,
      messageId: params.messageId ?? null,
      summary: params.summary.slice(0, 500),
      metadata: params.metadata ?? {},
      status: params.status,
      errorMessage: params.errorMessage ?? null,
    });
  } catch (err) {
    logger.warn({ err, type: params.type }, '⚠️ [알림 로그] DB 저장 실패 (무시)');
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`

- [ ] **Step 3: 커밋**

```bash
git add packages/bot/src/lib/notification-logger.ts
git commit -m "feat(bot): add notification logger helper"
```

---

### Task 4: 봇 채널 알림에 로깅 삽입

**Files:**
- Modify: `packages/bot/src/services/notification.service.ts`
- Modify: `packages/bot/src/schedulers/weekly-ranking.ts`
- Modify: `packages/bot/src/schedulers/curation-crawler.ts`
- Modify: `packages/bot/src/handlers/dm-handler.ts` (fine_payment 확인만)

- [ ] **Step 1: notification.service.ts — sendPostNotification (line ~422)**

import 추가: `import { logNotification } from '../lib/notification-logger';`

`await channel.send(message);` 호출을 수정하여 메시지 결과를 캡처하고 로그 삽입:

```typescript
// sendPostNotification 내부 try 블록
const sent = await channel.send(message);
await logNotification({
  source: 'bot',
  type: 'new_post',
  channelId: channel.id,
  channelName: channel.name ?? undefined,
  messageId: sent.id,
  summary: `새 글: ${input.post.title}`,
  metadata: { postTitle: input.post.title, memberDiscordId: input.member.discordId },
  status: 'sent',
});
```

catch 블록에도 실패 로그 추가:

```typescript
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  logger.error({ error }, '📢 [알림] 디스코드 알림 발송 실패');
  await logNotification({
    source: 'bot',
    type: 'new_post',
    channelId: channel?.id,
    channelName: channel?.name ?? undefined,
    summary: `새 글: ${input.post.title}`,
    status: 'failed',
    errorMessage: errorMsg,
  });
  return false;
}
```

- [ ] **Step 2: notification.service.ts — sendRoundReport (line ~445)**

같은 패턴. try 블록:

```typescript
const sent = await channel.send(message);
await logNotification({
  source: 'bot',
  type: 'round_report',
  channelId: channel.id,
  channelName: channel.name ?? undefined,
  messageId: sent.id,
  summary: `${data.round.roundNumber}회차 리포트`,
  status: 'sent',
});
```

catch 블록에도 failed 로그 추가.

- [ ] **Step 3: notification.service.ts — sendRoundStartAnnouncement (line ~475)**

```typescript
const sent = await channel.send(message);
await logNotification({
  source: 'bot',
  type: 'round_start',
  channelId: channel.id,
  channelName: channel.name ?? undefined,
  messageId: sent.id,
  summary: `${round.roundNumber}회차 시작 공지`,
  metadata: { activeMemberCount: activeMembers.length },
  status: 'sent',
});
```

catch 블록에도 failed 로그 추가.

- [ ] **Step 4: weekly-ranking.ts — sendWeeklyRanking (line ~254)**

import 추가: `import { logNotification } from '../lib/notification-logger';`

`await channel.send({ embeds: [embed] });` 수정:

```typescript
const sent = await channel.send({ embeds: [embed] });
await logNotification({
  source: 'bot',
  type: 'weekly_ranking',
  channelId: channel.id,
  channelName: 'name' in channel ? (channel as { name: string }).name : undefined,
  messageId: sent.id,
  summary: `주간 랭킹 발표 (${rankings.length}명)`,
  status: 'sent',
});
```

catch 블록에도 failed 로그 추가 (channelId를 사용 가능한 범위에서).

- [ ] **Step 5: curation-crawler.ts — shareDailyContent (line ~300)**

import 추가: `import { logNotification } from '../lib/notification-logger';`

`await channel.send(message);` 수정:

```typescript
const sent = await channel.send(message);
await logNotification({
  source: 'bot',
  type: 'curation',
  channelId: channel.id,
  channelName: 'name' in channel ? (channel as { name: string }).name : undefined,
  messageId: sent.id,
  summary: `큐레이션: ${item.title}`,
  status: 'sent',
});
```

catch 블록에도 failed 로그 추가.

- [ ] **Step 6: dm-handler.ts — fine_payment 확인 (line ~172)**

import 추가: `import { logNotification } from '../lib/notification-logger';`

`await (channel as TextChannel).send(...)` 후:

```typescript
await logNotification({
  source: 'bot',
  type: 'fine_payment',
  channelId: logChannelId,
  channelName: 'name' in channel ? (channel as { name: string }).name : undefined,
  summary: `${displayName}님 ${roundText} ${reason} 벌금 납부 확인`,
  status: 'sent',
});
```

- [ ] **Step 7: 타입체크**

Run: `pnpm typecheck`

- [ ] **Step 8: 커밋**

```bash
git add packages/bot/src/services/notification.service.ts packages/bot/src/schedulers/weekly-ranking.ts packages/bot/src/schedulers/curation-crawler.ts packages/bot/src/handlers/dm-handler.ts
git commit -m "feat(bot): add notification logging to channel messages"
```

---

### Task 5: 봇 DM 발송에 로깅 삽입

**Files:**
- Modify: `packages/bot/src/handlers/dm-handler.ts`
- Modify: `packages/bot/src/schedulers/deadline-reminder.ts`
- Modify: `packages/bot/src/schedulers/fine-reminder.ts`

- [ ] **Step 1: dm-handler.ts — sendFineNotification (line ~236)**

`await user.send({ content: message, components: [row] });` 후 (try 내):

```typescript
await logNotification({
  source: 'bot',
  type: 'fine_notification',
  targetDiscordId: discordId,
  summary: `${roundNumber}회차 벌금 알림 (${amount.toLocaleString()}원)`,
  status: 'sent',
});
```

catch 블록:

```typescript
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  logger.error({ discordId, error: serializeError(error) }, '💬 [DM] 벌금 알림 발송 실패');
  await logNotification({
    source: 'bot',
    type: 'fine_notification',
    targetDiscordId: discordId,
    summary: `${roundNumber}회차 벌금 알림 (${amount.toLocaleString()}원)`,
    status: 'failed',
    errorMessage: errorMsg,
  });
  return false;
}
```

- [ ] **Step 2: dm-handler.ts — sendFineReminder (line ~295)**

같은 패턴. try 블록 `await user.send(...)` 후:

```typescript
await logNotification({
  source: 'bot',
  type: 'fine_reminder',
  targetDiscordId: discordId,
  summary: `${roundNumber}회차 벌금 리마인더 (${daysSinceCreation}일 경과)`,
  status: 'sent',
});
```

catch에 failed 로그.

- [ ] **Step 3: dm-handler.ts — sendPollReminderDM (line ~355)**

try 블록 `await user.send(...)` 후:

```typescript
await logNotification({
  source: 'bot',
  type: 'poll_reminder',
  targetDiscordId: discordId,
  summary: `투표 리마인더: ${pollQuestion}`,
  status: 'sent',
});
```

catch에 failed 로그.

- [ ] **Step 4: deadline-reminder.ts — sendForDDay (line ~250)**

import 추가: `import { logNotification } from '../lib/notification-logger';`

user.send 루프 내부의 try 블록 `await user.send(dmContent);` 후:

```typescript
await logNotification({
  source: 'bot',
  type: 'deadline_reminder',
  targetDiscordId: member.discordId,
  summary: `D-${dDay} 마감 리마인더`,
  metadata: { dDay },
  status: 'sent',
});
sentCount++;
```

catch 블록:

```typescript
} catch (err) {
  const errorMsg = err instanceof Error ? err.message : String(err);
  logger.error(
    { discordId: member.discordId, err: serializeError(err) },
    '📅 [마감 리마인더] DM 발송 실패'
  );
  await logNotification({
    source: 'bot',
    type: 'deadline_reminder',
    targetDiscordId: member.discordId,
    summary: `D-${dDay} 마감 리마인더`,
    metadata: { dDay },
    status: 'failed',
    errorMessage: errorMsg,
  });
  failedCount++;
}
```

- [ ] **Step 5: fine-reminder.ts — sendGracePeriodNudge (line ~89)**

import 추가: `import { logNotification } from '../lib/notification-logger';`

user.send 루프 내부 `await user.send(...)` 후:

```typescript
await logNotification({
  source: 'bot',
  type: 'grace_nudge',
  targetDiscordId: member.discordId,
  summary: `${currentRound.roundNumber}회차 지각 독촉`,
  status: 'sent',
});
```

catch에 failed 로그.

- [ ] **Step 6: 타입체크**

Run: `pnpm typecheck`

- [ ] **Step 7: 커밋**

```bash
git add packages/bot/src/handlers/dm-handler.ts packages/bot/src/schedulers/deadline-reminder.ts packages/bot/src/schedulers/fine-reminder.ts
git commit -m "feat(bot): add notification logging to DM sends"
```

---

### Task 6: 웹 알림 로그 헬퍼 + discord-notify 확장

**Files:**
- Create: `packages/web/src/lib/notification-log.ts`
- Modify: `packages/web/src/lib/discord-notify.ts`

- [ ] **Step 1: 웹 알림 로그 헬퍼 생성**

`packages/web/src/lib/notification-log.ts`:

```typescript
import { db as sharedDb } from '@blog-study/shared';
import { db } from '@/lib/db';

const { discordNotificationLogs } = sharedDb;

interface LogNotificationParams {
  source: 'bot' | 'web';
  type: string;
  channelId?: string;
  channelName?: string;
  targetDiscordId?: string;
  messageId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  status: 'sent' | 'failed';
  errorMessage?: string;
}

export async function logNotification(params: LogNotificationParams): Promise<void> {
  try {
    const database = db();
    await database.insert(discordNotificationLogs).values({
      source: params.source,
      type: params.type,
      channelId: params.channelId ?? null,
      channelName: params.channelName ?? null,
      targetDiscordId: params.targetDiscordId ?? null,
      messageId: params.messageId ?? null,
      summary: params.summary.slice(0, 500),
      metadata: params.metadata ?? {},
      status: params.status,
      errorMessage: params.errorMessage ?? null,
    });
  } catch (err) {
    console.error('[notification-log] DB 저장 실패:', err);
  }
}
```

- [ ] **Step 2: discord-notify.ts — sendDiscordChannelMessage 반환타입 확장**

현재 반환: `Promise<boolean>`
변경: `Promise<{ success: boolean; messageId?: string; error?: string }>`

```typescript
export async function sendDiscordChannelMessage(
  options: SendChannelMessageOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('[discord-notify] DISCORD_TOKEN이 설정되지 않았습니다.');
    return { success: false, error: 'DISCORD_TOKEN 미설정' };
  }

  if (!SNOWFLAKE_RE.test(options.channelId)) {
    console.error('[discord-notify] 유효하지 않은 channelId:', options.channelId);
    return { success: false, error: `유효하지 않은 channelId: ${options.channelId}` };
  }

  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${options.channelId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: options.content,
          embeds: options.embeds,
          components: options.components,
          allowed_mentions: { parse: options.allowEveryone ? ['everyone'] : [] },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[discord-notify] 메시지 전송 실패 (${response.status})`);
      return { success: false, error: `HTTP ${response.status}: ${errorText.slice(0, 200)}` };
    }

    const data = await response.json().catch(() => null);
    return { success: true, messageId: data?.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[discord-notify] 메시지 전송 중 오류:', error);
    return { success: false, error: errorMsg };
  }
}
```

**주의**: 기존 호출자들이 `if (await sendDiscordChannelMessage(...))` 패턴을 사용하는지 확인. 객체는 항상 truthy이므로, 기존 호출자들이 `const result = await sendDiscordChannelMessage(...); if (result)` 패턴이라면 `result.success`로 변경해야 함. 현재 코드 확인 결과 호출자들은 반환값을 사용하지 않으므로 (fire-and-forget), 문제 없음.

- [ ] **Step 3: 타입체크**

Run: `pnpm typecheck`

- [ ] **Step 4: 커밋**

```bash
git add packages/web/src/lib/notification-log.ts packages/web/src/lib/discord-notify.ts
git commit -m "feat(web): add notification log helper and extend discord-notify return type"
```

---

### Task 7: 웹 호출자에 로깅 삽입

**Files:**
- Modify: `packages/web/src/app/api/board/route.ts` (~line 300)
- Modify: `packages/web/src/app/api/posts/manual/route.ts` (~line 315)

- [ ] **Step 1: board/route.ts — 공지 알림 로깅**

import 추가: `import { logNotification } from '@/lib/notification-log';`

기존 `await sendDiscordChannelMessage({...})` 를 결과 캡처로 변경:

```typescript
const result = await sendDiscordChannelMessage({
  channelId,
  allowEveryone: true,
  content: `@everyone\n\n📢 **새로운 공지사항이 등록되었습니다!**\n\n## ${title.trim().slice(0, 100)}`,
  components: [...],
});

await logNotification({
  source: 'web',
  type: 'announcement',
  channelId,
  summary: `공지: ${title.trim().slice(0, 100)}`,
  messageId: result.messageId,
  status: result.success ? 'sent' : 'failed',
  errorMessage: result.error,
});
```

- [ ] **Step 2: posts/manual/route.ts — 수동등록 알림 로깅**

import 추가: `import { logNotification } from '@/lib/notification-log';`

after() 내 `await sendDiscordChannelMessage({...})` 를 결과 캡처로 변경:

```typescript
const result = await sendDiscordChannelMessage({
  channelId,
  content: `<@${member.discordId}>님이 새 글을 발행했습니다! 🎉`,
  embeds: [...],
  components: [...],
});

await logNotification({
  source: 'web',
  type: 'post_register',
  channelId,
  summary: `수동등록: ${title!.slice(0, 100)}`,
  messageId: result.messageId,
  status: result.success ? 'sent' : 'failed',
  errorMessage: result.error,
});
```

- [ ] **Step 3: 다른 sendDiscordChannelMessage 호출자 확인 후 동일 패턴 적용**

`member_approval` 등 다른 호출 지점도 grep으로 찾아서 동일하게 로깅 삽입.

- [ ] **Step 4: 타입체크**

Run: `pnpm typecheck`

- [ ] **Step 5: 커밋**

```bash
git add packages/web/src/app/api/board/route.ts packages/web/src/app/api/posts/manual/route.ts
git commit -m "feat(web): add notification logging to discord channel messages"
```

---

### Task 8: 관리자 로그 조회 API

**Files:**
- Create: `packages/web/src/app/api/admin/bot-logs/route.ts`

- [ ] **Step 1: API 라우트 생성**

```typescript
import { NextRequest } from 'next/server';
import { desc, eq, and, lt, type SQL } from 'drizzle-orm';
import { db as sharedDb } from '@blog-study/shared';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin';
import { successResponse, Errors, withCache } from '@/lib/api-error';

const { discordNotificationLogs } = sharedDb;

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const source = searchParams.get('source');
    const status = searchParams.get('status');
    const target = searchParams.get('target'); // 'channel' | 'dm'
    const cursor = searchParams.get('cursor'); // ISO timestamp
    const limit = Math.min(Number(searchParams.get('limit') || 20), 50);

    const database = db();
    const conditions: SQL[] = [];

    if (type) conditions.push(eq(discordNotificationLogs.type, type));
    if (source) conditions.push(eq(discordNotificationLogs.source, source));
    if (status) conditions.push(eq(discordNotificationLogs.status, status));
    if (cursor) {
      conditions.push(lt(discordNotificationLogs.createdAt, new Date(cursor)));
    }

    // target 필터: channel = targetDiscordId is null, dm = targetDiscordId is not null
    if (target === 'channel') {
      const { isNull } = await import('drizzle-orm');
      conditions.push(isNull(discordNotificationLogs.targetDiscordId));
    } else if (target === 'dm') {
      const { isNotNull } = await import('drizzle-orm');
      conditions.push(isNotNull(discordNotificationLogs.targetDiscordId));
    }

    const logs = await database
      .select()
      .from(discordNotificationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(discordNotificationLogs.createdAt))
      .limit(limit + 1); // +1 for next cursor

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null;

    return withCache(
      successResponse({ logs: items, nextCursor, hasMore }),
      10
    );
  } catch (error) {
    console.error('Bot logs API error:', error);
    return Errors.internalError().toResponse();
  }
});
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`

- [ ] **Step 3: 커밋**

```bash
git add packages/web/src/app/api/admin/bot-logs/route.ts
git commit -m "feat(web): add admin bot-logs API route"
```

---

### Task 9: 관리자 로그 UI

**Files:**
- Create: `packages/web/src/app/(admin)/admin/bot-operations/notification-logs.tsx`
- Modify: `packages/web/src/app/(admin)/admin/bot-operations/page.tsx`

- [ ] **Step 1: 로그 리스트 컴포넌트 생성**

`packages/web/src/app/(admin)/admin/bot-operations/notification-logs.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getLogTypeMeta,
  notificationLogTypeConfig,
} from '@/lib/notification-log-config';

interface LogEntry {
  id: string;
  source: string;
  type: string;
  channelId: string | null;
  channelName: string | null;
  targetDiscordId: string | null;
  messageId: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function NotificationLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [targetFilter, setTargetFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(
    async (nextCursor?: string | null) => {
      try {
        const params = new URLSearchParams();
        if (typeFilter !== 'all') params.set('type', typeFilter);
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (targetFilter !== 'all') params.set('target', targetFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (nextCursor) params.set('cursor', nextCursor);
        params.set('limit', '20');

        const res = await fetch(`/api/admin/bot-logs?${params}`);
        if (!res.ok) throw new Error('로그 조회 실패');
        const json = await res.json();
        const data = json.data;

        if (nextCursor) {
          setLogs((prev) => [...prev, ...data.logs]);
        } else {
          setLogs(data.logs);
        }
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch {
        toast.error('알림 로그를 불러오는데 실패했습니다');
      } finally {
        setIsLoading(false);
      }
    },
    [typeFilter, sourceFilter, targetFilter, statusFilter]
  );

  // 필터 변경 시 리셋
  useEffect(() => {
    setIsLoading(true);
    setLogs([]);
    setCursor(null);
    fetchLogs();
  }, [fetchLogs]);

  // 무한 스크롤
  useEffect(() => {
    if (!observerRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && cursor) {
          fetchLogs(cursor);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [cursor, hasMore, fetchLogs]);

  const typeOptions = Object.entries(notificationLogTypeConfig).map(
    ([value, meta]) => ({ value, label: meta.label })
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="타입" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 타입</SelectItem>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="소스" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="bot">봇</SelectItem>
            <SelectItem value="web">웹</SelectItem>
          </SelectContent>
        </Select>

        <Select value={targetFilter} onValueChange={setTargetFilter}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="대상" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="channel">채널</SelectItem>
            <SelectItem value="dm">DM</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="sent">성공</SelectItem>
            <SelectItem value="failed">실패</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="text-sm text-muted-foreground">알림 로그가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const meta = getLogTypeMeta(log.type);
            return (
              <Card key={log.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Status dot */}
                    <div
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        log.status === 'sent' ? 'bg-green-500' : 'bg-red-500'
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] px-1.5 py-0', meta.color)}
                        >
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {log.source}
                        </Badge>
                        {log.channelName && (
                          <span className="text-[10px] text-muted-foreground">
                            #{log.channelName}
                          </span>
                        )}
                        {log.targetDiscordId && (
                          <span className="text-[10px] text-muted-foreground">
                            DM:{log.targetDiscordId}
                          </span>
                        )}
                      </div>

                      {/* Summary */}
                      {log.summary && (
                        <p className="text-sm truncate">{log.summary}</p>
                      )}

                      {/* Error message */}
                      {log.errorMessage && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">
                          {log.errorMessage}
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Infinite scroll sentinel */}
          <div ref={observerRef} className="h-4" />
          {hasMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: page.tsx에 탭 추가**

기존 `bot-operations/page.tsx`를 탭 형태로 리팩토링:

```typescript
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BotOperation } from '@/components/bot-operation-card';
import { BotOperationRow, categoryConfig } from '@/components/bot-operation-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import NotificationLogs from './notification-logs';

const CATEGORY_ORDER = ['polling', 'attendance', 'fine', 'round', 'ranking', 'poll', 'curation'];

export default function BotOperationsPage() {
  // ... (기존 state, fetchOperations, handleTrigger, grouped useMemo, useEffect 그대로 유지)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">봇 관리</h1>
        <p className="text-muted-foreground mt-1 text-sm">봇 작업 실행 및 알림 로그 확인</p>
      </div>

      <Tabs defaultValue="operations">
        <TabsList>
          <TabsTrigger value="operations">수동 실행</TabsTrigger>
          <TabsTrigger value="logs">알림 로그</TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="mt-4">
          {isLoading ? (
            // ... 기존 로딩 UI
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* 기존 grouped.map 카드 그리드 */}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <NotificationLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Tabs 컴포넌트 존재 확인**

Run: `ls packages/web/src/components/ui/tabs.tsx`

없으면: `cd packages/web && npx shadcn@latest add tabs`

- [ ] **Step 4: 타입체크**

Run: `pnpm typecheck`

- [ ] **Step 5: 커밋**

```bash
git add packages/web/src/app/\(admin\)/admin/bot-operations/notification-logs.tsx packages/web/src/app/\(admin\)/admin/bot-operations/page.tsx
git commit -m "feat(web): add notification logs tab to admin bot operations page"
```

---

### Task 10: 통합 검증

- [ ] **Step 1: shared 리빌드 + 전체 타입체크**

```bash
pnpm --filter @blog-study/shared build && pnpm typecheck
```

- [ ] **Step 2: 린트**

```bash
pnpm lint
```

- [ ] **Step 3: 빌드**

```bash
pnpm build
```

- [ ] **Step 4: 최종 커밋 (린트 수정 등)**

필요 시 린트/타입 에러 수정 후 커밋.
