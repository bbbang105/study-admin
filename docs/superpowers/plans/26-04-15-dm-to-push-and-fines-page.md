# Discord DM → FCM 푸시 전환 + 벌금 상세 페이지 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discord DM 개인 알림을 FCM 푸시로 전환하고, 벌금 상세/납부 페이지를 웹에 구축한다.

**Architecture:** 봇 스케줄러가 DM 대신 웹 내부 API(`/api/internal/reminder-push`)를 호출 → 웹에서 FCM 발송. 벌금 납부는 `/profile/fines` 페이지에서 처리. 알림 로그에 `push` 대상 타입 추가.

**Tech Stack:** Next.js 16 App Router, discord.js v14, Drizzle ORM, FCM (Firebase Admin), shadcn/ui, sonner

**Spec:** `docs/superpowers/specs/26-04-15-dm-to-push-and-fines-page-design.md`

---

### Task 1: NotificationType 확장 + 알림 로그 config 업데이트

**Files:**
- Modify: `packages/shared/src/db/schema.ts:579-586` (NotificationType)
- Modify: `packages/web/src/lib/notification-log-config.ts` (isDM → target, 푸시 타입 추가)
- Modify: `packages/web/src/components/settings/push-notification-settings.tsx:17-42` (NOTIFICATION_LABELS)

- [ ] **Step 1: NotificationType에 5종 추가**

`packages/shared/src/db/schema.ts` — `NotificationType` 객체에 추가:

```ts
export const NotificationType = {
  BOARD_COMMENT: 'board_comment',
  BOARD_REPLY: 'board_reply',
  POST_COMMENT: 'post_comment',
  POST_REPLY: 'post_reply',
  BOARD_NOTICE: 'board_notice',
  NEW_POST: 'new_post',
  FINE_NOTIFICATION: 'fine_notification',
  FINE_REMINDER: 'fine_reminder',
  DEADLINE_REMINDER: 'deadline_reminder',
  GRACE_NUDGE: 'grace_nudge',
  POLL_REMINDER: 'poll_reminder',
} as const;
```

- [ ] **Step 2: notification-log-config.ts — isDM → target 전환**

`packages/web/src/lib/notification-log-config.ts`:

인터페이스 변경:
```ts
export interface NotificationLogTypeMeta {
  label: string;
  color: string;
  target: 'channel' | 'dm' | 'push';
}
```

기존 모든 항목에서 `isDM: false` → `target: 'channel'`, `isDM: true` → `target: 'push'` (새 푸시 알림으로 전환되므로).

기존 DM 타입 5종(`deadline_reminder`, `fine_notification`, `fine_reminder`, `grace_nudge`, `poll_reminder`)은 `target: 'push'`로 변경.

`getLogTypeMeta` 함수의 `fallbackMeta`도 `isDM` → `target: 'channel'`.

- [ ] **Step 3: 알림 로그 관리자 UI 필터 — 푸시 옵션 추가**

`packages/web/src/app/(admin)/admin/bot-operations/notification-logs.tsx`:

대상 필터의 `<SelectContent>`에 `<SelectItem value="push">푸시</SelectItem>` 추가.

로그 표시 부분에서 `isDM` 변수 대신 `getLogTypeMeta(log.type).target` 사용:
```tsx
const target = meta.target;
// 대상 표시:
// target === 'push' → '푸시'
// target === 'dm' → `DM → ${log.targetDiscordId}`
// target === 'channel' → `#${log.channelName || log.channelId || '—'}`
```

- [ ] **Step 4: 알림 로그 API — push 필터 지원**

`packages/web/src/app/api/admin/bot-logs/route.ts`:

기존 `target` 파라미터 처리에 `push` 분기 추가:
```ts
if (target === 'push') {
  // push 알림은 targetDiscordId도 channelId도 없는 로그
  // notification-log-config의 target이 'push'인 type들로 필터
  const pushTypes = Object.entries(notificationLogTypeConfig)
    .filter(([, meta]) => meta.target === 'push')
    .map(([type]) => type);
  conditions.push(inArray(discordNotificationLogs.type, pushTypes));
}
```

`notification-log-config`에서 `notificationLogTypeConfig` import 추가.

- [ ] **Step 5: 알림 설정 UI — 새 타입 추가**

`packages/web/src/components/settings/push-notification-settings.tsx`:

`NOTIFICATION_LABELS`에 추가 (import에 `Wallet`, `Clock`, `AlertTriangle`, `Vote` from lucide-react):
```ts
fine_notification: {
  label: '벌금 알림',
  icon: Wallet,
  description: '벌금이 부과될 때',
},
fine_reminder: {
  label: '벌금 리마인더',
  icon: Wallet,
  description: '미납 벌금 독촉',
},
deadline_reminder: {
  label: '마감 리마인더',
  icon: Clock,
  description: '제출 마감 D-2/D-1/D-day',
},
grace_nudge: {
  label: '지각 독촉',
  icon: AlertTriangle,
  description: '지각 기간 제출 독려',
},
poll_reminder: {
  label: '투표 리마인더',
  icon: Vote,
  description: '투표 마감 전 참여 요청',
},
```

- [ ] **Step 6: shared 패키지 빌드 + typecheck**

```bash
pnpm --filter @blog-study/shared build
pnpm typecheck
```

- [ ] **Step 7: 커밋**

```bash
git add packages/shared/src/db/schema.ts packages/web/src/lib/notification-log-config.ts packages/web/src/components/settings/push-notification-settings.tsx packages/web/src/app/api/admin/bot-logs/route.ts packages/web/src/app/(admin)/admin/bot-operations/notification-logs.tsx
git commit -m "feat: NotificationType 5종 확장 + 알림 로그 push 대상 추가"
```

---

### Task 2: 벌금 상세 페이지 API

**Files:**
- Create: `packages/web/src/app/api/profile/fines/route.ts`
- Create: `packages/web/src/app/api/fines/[id]/pay/route.ts`

- [ ] **Step 1: GET /api/profile/fines — 내 벌금 목록 조회 API**

`packages/web/src/app/api/profile/fines/route.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { getDb } from '@/lib/db';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { members, fines, rounds, FineStatus } = sharedDb;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Errors.unauthorized().toResponse();

    const discordId = user.identities?.find((i) => i.provider === 'discord')?.id;
    if (!discordId) return Errors.unauthorized().toResponse();

    const database = getDb();
    const [member] = await database
      .select({ id: members.id })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!member) return Errors.notFound('멤버를 찾을 수 없습니다.').toResponse();

    const fineList = await database
      .select({
        id: fines.id,
        roundNumber: rounds.roundNumber,
        type: fines.type,
        amount: fines.amount,
        status: fines.status,
        createdAt: fines.createdAt,
        paidAt: fines.paidAt,
      })
      .from(fines)
      .innerJoin(rounds, eq(fines.roundId, rounds.id))
      .where(eq(fines.memberId, member.id))
      .orderBy(
        sql`CASE WHEN ${fines.status} = ${FineStatus.UNPAID} THEN 0 ELSE 1 END`,
        sql`${fines.createdAt} DESC`
      );

    const summary = {
      unpaid: fineList
        .filter((f) => f.status === FineStatus.UNPAID)
        .reduce((sum, f) => sum + f.amount, 0),
      paid: fineList
        .filter((f) => f.status === FineStatus.PAID)
        .reduce((sum, f) => sum + f.amount, 0),
      total: fineList.reduce((sum, f) => sum + f.amount, 0),
    };

    return successResponse({ fines: fineList, summary });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: PATCH /api/fines/[id]/pay — 납부 완료 처리 API**

`packages/web/src/app/api/fines/[id]/pay/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { getDb } from '@/lib/db';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { sendDiscordMessage } from '@/lib/discord-notify';
import { logNotification } from '@/lib/notification-log';

const { members, fines, rounds, FineStatus } = sharedDb;

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fineId } = await params;
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Errors.unauthorized().toResponse();

    const discordId = user.identities?.find((i) => i.provider === 'discord')?.id;
    if (!discordId) return Errors.unauthorized().toResponse();

    const database = getDb();

    // 멤버 조회
    const [member] = await database
      .select({ id: members.id, name: members.name, nickname: members.nickname })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);
    if (!member) return Errors.notFound('멤버를 찾을 수 없습니다.').toResponse();

    // 벌금 조회 + 본인 검증
    const [fine] = await database
      .select()
      .from(fines)
      .where(eq(fines.id, fineId))
      .limit(1);
    if (!fine) return Errors.notFound('벌금을 찾을 수 없습니다.').toResponse();
    if (fine.memberId !== member.id) return Errors.forbidden('본인의 벌금만 처리할 수 있습니다.').toResponse();
    if (fine.status !== FineStatus.UNPAID) return Errors.badRequest('이미 처리된 벌금입니다.').toResponse();

    // 납부 처리
    const [updated] = await database
      .update(fines)
      .set({
        status: FineStatus.PAID,
        paidAt: new Date(),
        pendingConfirmation: false,
      })
      .where(eq(fines.id, fineId))
      .returning();

    // 관리자 Discord 채널 알림 (fire-and-forget)
    after(async () => {
      try {
        const [round] = await database
          .select({ roundNumber: rounds.roundNumber })
          .from(rounds)
          .where(eq(rounds.id, fine.roundId))
          .limit(1);

        const displayName = member.name || member.nickname;
        const reason = fine.type === 'late' ? '지각' : '결석';
        const roundText = round ? `${round.roundNumber}회차` : '';

        const adminChannelId = process.env.DISCORD_ADMIN_CHANNEL_ID;
        if (adminChannelId) {
          await sendDiscordMessage(adminChannelId, {
            content: `💰 **${displayName}**님이 ${roundText} ${reason} 벌금 ${fine.amount.toLocaleString()}원 납부를 완료했습니다. (웹)`,
          });
          await logNotification({
            source: 'web',
            type: 'fine_payment',
            channelId: adminChannelId,
            summary: `${displayName}님 ${roundText} ${reason} 벌금 납부 확인 (웹)`,
            status: 'sent',
          });
        }
      } catch (err) {
        console.error('[fines/pay] Admin notification failed:', err);
      }
    });

    return successResponse({ fine: updated }, '납부가 확인되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
```

**참고:** 관리자 채널 ID는 기존 `ConfigKeys.BOT_LOG_CHANNEL_ID`와 동일. 봇은 DB config에서 읽지만, 웹은 환경변수(`DISCORD_ADMIN_CHANNEL_ID`)로 주입. 이미 다른 웹 알림(`discord-notify.ts`)에서 같은 패턴 사용 중인지 확인 후, 기존 패턴을 따른다.

- [ ] **Step 3: 관리자 채널 ID 확인**

`sendDiscordMessage` 함수 시그니처와 기존 웹→Discord 알림 패턴을 확인:

```bash
grep -n "sendDiscordMessage\|admin.*channel\|BOT_LOG" packages/web/src/lib/discord-notify.ts packages/web/src/app/api/ -r | head -20
```

기존 패턴에 맞춰 채널 ID 소스를 결정한다 (환경변수 or DB config). 기존 `discord-notify.ts`가 채널 ID를 인자로 받는 구조이므로 호출처에서 결정.

- [ ] **Step 4: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: 커밋**

```bash
git add packages/web/src/app/api/profile/fines/route.ts packages/web/src/app/api/fines/
git commit -m "feat: 벌금 목록 조회 + 납부 완료 API"
```

---

### Task 3: 벌금 상세 페이지 UI

**Files:**
- Create: `packages/web/src/app/(user)/profile/fines/page.tsx`
- Modify: `packages/web/src/app/(user)/profile/page.tsx:435-455` (스탯 카드에 Link 래핑)

- [ ] **Step 1: 벌금 상세 페이지 컴포넌트 생성**

`packages/web/src/app/(user)/profile/fines/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageError } from '@/components/ui/page-state';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Fine {
  id: string;
  roundNumber: number;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

interface FinesData {
  fines: Fine[];
  summary: { unpaid: number; paid: number; total: number };
}

function formatFineType(type: string): string {
  return type === 'late' ? '지각' : '결석';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

export default function FinesPage() {
  const router = useRouter();
  const [data, setData] = useState<FinesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingFineId, setPayingFineId] = useState<string | null>(null);
  const [confirmFineId, setConfirmFineId] = useState<string | null>(null);

  const fetchFines = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/fines');
      if (!res.ok) throw new Error('Failed to fetch fines');
      const result = await res.json();
      setData(result.data);
    } catch {
      setError('벌금 내역을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFines();
  }, [fetchFines]);

  const handlePay = async (fineId: string) => {
    setPayingFineId(fineId);
    try {
      const res = await fetch(`/api/fines/${fineId}/pay`, { method: 'PATCH' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || '납부 처리에 실패했습니다.');
      toast.success('납부가 확인되었습니다.');
      await fetchFines();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '납부 처리에 실패했습니다.');
    } finally {
      setPayingFineId(null);
      setConfirmFineId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) return <PageError message={error} />;
  if (!data) return null;

  const unpaidFines = data.fines.filter((f) => f.status === 'PENDING');
  const completedFines = data.fines.filter((f) => f.status !== 'PENDING');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-0.5">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          프로필
        </button>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Profile / Fines
        </p>
        <h1 className="text-xl font-semibold tracking-tight">벌금 내역</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">미납</p>
            <p className="text-lg font-bold tracking-tight text-destructive">
              {data.summary.unpaid.toLocaleString()}원
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">납부완료</p>
            <p className="text-lg font-bold tracking-tight text-green-500">
              {data.summary.paid.toLocaleString()}원
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">총 벌금</p>
            <p className="text-lg font-bold tracking-tight">
              {data.summary.total.toLocaleString()}원
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Unpaid Section */}
      {unpaidFines.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-destructive">미납 벌금</p>
          {unpaidFines.map((fine) => (
            <Card key={fine.id} className="border-border/60 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {fine.roundNumber}회차 · {formatFineType(fine.type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(fine.createdAt)}
                    </p>
                  </div>
                  <div className="text-right space-y-1.5">
                    <p className="text-sm font-semibold text-destructive">
                      {fine.amount.toLocaleString()}원
                    </p>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={payingFineId === fine.id}
                      onClick={() => setConfirmFineId(fine.id)}
                    >
                      {payingFineId === fine.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        '납부 완료'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed Section */}
      {completedFines.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">납부 / 면제</p>
          {completedFines.map((fine) => (
            <Card key={fine.id} className="border-border/60 shadow-none opacity-70">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {fine.roundNumber}회차 · {formatFineType(fine.type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(fine.createdAt)}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-medium text-muted-foreground line-through">
                      {fine.amount.toLocaleString()}원
                    </p>
                    {fine.status === 'PAID' ? (
                      <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-500">
                        납부완료
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-500">
                        면제
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {data.fines.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground">
          <Wallet className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">벌금 내역이 없습니다.</p>
        </div>
      )}

      {/* Account Info */}
      {unpaidFines.length > 0 && (
        <Card className="border-border/60 shadow-none bg-muted/50">
          <CardContent className="p-4 text-center space-y-0.5">
            <p className="text-xs text-muted-foreground">입금 계좌</p>
            <p className="text-sm font-semibold">3333333114501 카카오뱅크</p>
          </CardContent>
        </Card>
      )}

      {/* Payment Confirmation Dialog */}
      <AlertDialog open={!!confirmFineId} onOpenChange={(open) => !open && setConfirmFineId(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">납부 완료 처리</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              입금을 완료하셨나요? 확인 후 납부 완료 처리됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-sm">취소</AlertDialogCancel>
            <AlertDialogAction
              className="h-9 text-sm"
              disabled={!!payingFineId}
              onClick={() => confirmFineId && handlePay(confirmFineId)}
            >
              {payingFineId ? '처리 중...' : '납부 완료'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: 프로필 스탯 카드에 Link 추가**

`packages/web/src/app/(user)/profile/page.tsx`:

미납 벌금 스탯 카드(`data.stats.unpaidFines` 표시 부분, line ~435-455)를 `<Link href="/profile/fines">` 로 래핑.

기존:
```tsx
<Card className="border-border/60 shadow-none">
  <CardContent className="p-4">
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">미납 벌금</p>
        ...
```

변경:
```tsx
<Link href="/profile/fines">
  <Card className="border-border/60 shadow-none hover:bg-muted/50 transition-colors cursor-pointer">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">미납 벌금</p>
          ...
```

`Link`는 이미 import 되어 있음 (`import Link from 'next/link'`, line 3).

- [ ] **Step 3: dev 서버 확인 + typecheck**

```bash
pnpm typecheck
```

dev 서버에서 `/profile` → 미납 벌금 카드 클릭 → `/profile/fines` 이동 확인.

- [ ] **Step 4: 커밋**

```bash
git add packages/web/src/app/\(user\)/profile/fines/page.tsx packages/web/src/app/\(user\)/profile/page.tsx
git commit -m "feat: 벌금 상세 페이지 + 프로필 스탯 카드 링크"
```

---

### Task 4: 웹 내부 API — reminder-push

**Files:**
- Create: `packages/web/src/app/api/internal/reminder-push/route.ts`

- [ ] **Step 1: POST /api/internal/reminder-push 구현**

`packages/web/src/app/api/internal/reminder-push/route.ts`:

```ts
import { timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { sendPushToMembers } from '@/lib/push';
import { logNotification } from '@/lib/notification-log';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(): boolean {
  const key = 'reminder-push';
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit()) {
      return Errors.badRequest('Rate limit exceeded').toResponse();
    }

    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.INTERNAL_API_KEY;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!expectedKey || !token || !safeCompare(token, expectedKey)) {
      return Errors.unauthorized('Invalid API key').toResponse();
    }

    const body = await request.json();
    const { type, memberIds, title, body: pushBody, clickUrl } = body;

    // Validation
    if (typeof type !== 'string' || typeof title !== 'string' || typeof pushBody !== 'string' || typeof clickUrl !== 'string') {
      return Errors.badRequest('type, memberIds, title, body, clickUrl are required').toResponse();
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return Errors.badRequest('memberIds must be a non-empty array').toResponse();
    }
    if (!memberIds.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
      return Errors.badRequest('Invalid memberIds format').toResponse();
    }
    if (title.length > 200) return Errors.badRequest('title too long (max 200)').toResponse();
    if (pushBody.length > 1000) return Errors.badRequest('body too long (max 1000)').toResponse();
    if (!clickUrl.startsWith('/')) return Errors.badRequest('clickUrl must start with /').toResponse();

    const result = await sendPushToMembers(memberIds, {
      title,
      body: pushBody,
      clickUrl,
      data: { type },
    });

    // 알림 로그 기록
    await logNotification({
      source: 'web',
      type,
      summary: `[푸시] ${title}: ${pushBody}`.slice(0, 500),
      metadata: { memberCount: memberIds.length, ...result },
      status: result.success > 0 ? 'sent' : 'failed',
      errorMessage: result.success === 0 && result.failed > 0 ? `${result.failed}건 전송 실패` : undefined,
    });

    return successResponse(result);
  } catch (error) {
    console.error('[internal/reminder-push] Error:', error);
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: 커밋**

```bash
git add packages/web/src/app/api/internal/reminder-push/route.ts
git commit -m "feat: 범용 리마인더 푸시 내부 API"
```

---

### Task 5: 봇 push-client + DM→푸시 전환

**Files:**
- Create: `packages/bot/src/lib/push-client.ts`
- Modify: `packages/bot/src/handlers/dm-handler.ts:206-409` (send 함수들 내부 교체)
- Modify: `packages/bot/src/schedulers/fine-reminder.ts:52-115` (grace nudge)
- Modify: `packages/bot/src/schedulers/deadline-reminder.ts:198-289` (sendForDDay)
- Modify: `packages/bot/src/schedulers/poll-reminder.ts:142-217` (sendDMsToNonVoters)

- [ ] **Step 1: push-client.ts — 웹 내부 API 호출 래퍼**

`packages/bot/src/lib/push-client.ts`:

```ts
import logger from './logger';

interface ReminderPushPayload {
  type: string;
  memberIds: string[];
  title: string;
  body: string;
  clickUrl: string;
}

interface PushResult {
  success: number;
  failed: number;
}

export async function sendReminderPush(payload: ReminderPushPayload): Promise<PushResult> {
  const webUrl = process.env.WEB_URL;
  const apiKey = process.env.INTERNAL_API_KEY;

  if (!webUrl || !apiKey) {
    logger.warn('📱 [Push] WEB_URL 또는 INTERNAL_API_KEY 미설정, 푸시 스킵');
    return { success: 0, failed: payload.memberIds.length };
  }

  try {
    const res = await fetch(`${webUrl}/api/internal/reminder-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error({ status: res.status, body: text }, '📱 [Push] 내부 API 호출 실패');
      return { success: 0, failed: payload.memberIds.length };
    }

    const json = await res.json();
    const result: PushResult = json.data ?? { success: 0, failed: 0 };
    logger.info({ type: payload.type, ...result }, '📱 [Push] 발송 완료');
    return result;
  } catch (error) {
    logger.error({ error, type: payload.type }, '📱 [Push] 내부 API 호출 에러');
    return { success: 0, failed: payload.memberIds.length };
  }
}
```

- [ ] **Step 2: dm-handler.ts — sendFineNotification을 푸시로 전환**

`sendFineNotification()` 함수 시그니처 변경: `client` 파라미터 제거, `memberId` 추가.

```ts
export async function sendFineNotification(
  memberId: string,
  fineId: string,
  amount: number,
  type: 'late' | 'absent',
  roundNumber: number
): Promise<boolean> {
  try {
    const reason = formatFineReason(type);

    const result = await sendReminderPush({
      type: 'fine_notification',
      memberIds: [memberId],
      title: '벌금이 부과되었어요',
      body: `${roundNumber}회차 ${reason} 벌금 ${amount.toLocaleString()}원이 부과되었습니다.`,
      clickUrl: '/profile/fines',
    });

    await addPendingConfirmation(memberId, fineId);

    logger.info({ memberId, fineId }, '📱 [Push] 벌금 알림 발송 완료');
    return result.success > 0;
  } catch (error) {
    logger.error({ memberId, error: serializeError(error) }, '📱 [Push] 벌금 알림 발송 실패');
    return false;
  }
}
```

import 추가: `import { sendReminderPush } from '../lib/push-client';`
import 제거: `Client` 관련 import에서 `Client` 사용하는 부분 정리 (setupDMHandler에서는 여전히 필요).

- [ ] **Step 3: dm-handler.ts — sendFineReminder을 푸시로 전환**

```ts
export async function sendFineReminder(
  memberId: string,
  fineId: string,
  amount: number,
  type: 'late' | 'absent',
  roundNumber: number,
  daysSinceCreation: number
): Promise<boolean> {
  try {
    const reason = formatFineReason(type);

    const result = await sendReminderPush({
      type: 'fine_reminder',
      memberIds: [memberId],
      title: '미납 벌금 리마인더',
      body: `${roundNumber}회차 ${reason} 벌금이 ${daysSinceCreation}일째 미납 상태입니다.`,
      clickUrl: '/profile/fines',
    });

    await addPendingConfirmation(memberId, fineId);

    logger.info({ memberId, fineId }, '📱 [Push] 벌금 리마인더 발송 완료');
    return result.success > 0;
  } catch (error) {
    logger.error({ memberId, error: serializeError(error) }, '📱 [Push] 벌금 리마인더 발송 실패');
    return false;
  }
}
```

- [ ] **Step 4: dm-handler.ts — sendPollReminderDM을 푸시로 전환**

함수명을 `sendPollReminderPush`로 변경하고, 시그니처 변경:

```ts
export async function sendPollReminderPush(
  memberId: string,
  pollQuestion: string,
  expiresAt: Date,
  postId: string,
): Promise<boolean> {
  try {
    const expiresHour = expiresAt.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const result = await sendReminderPush({
      type: 'poll_reminder',
      memberIds: [memberId],
      title: '투표에 참여해주세요',
      body: `"${pollQuestion}" 투표가 ${expiresHour}에 마감됩니다!`,
      clickUrl: `/board/${postId}`,
    });

    logger.info({ memberId, pollQuestion }, '📱 [Push] 투표 리마인더 발송 완료');
    return result.success > 0;
  } catch (error) {
    logger.error({ memberId, error: serializeError(error) }, '📱 [Push] 투표 리마인더 발송 실패');
    return false;
  }
}
```

dm-handler.ts에서 기존 `logNotification` import와 DM 발송 함수 내의 `logNotification` 호출을 모두 제거 (웹 API가 로그를 담당).

- [ ] **Step 5: fine-reminder.ts — sendGracePeriodNudge를 푸시로 전환**

`packages/bot/src/schedulers/fine-reminder.ts`의 `sendGracePeriodNudge()` 수정.

`Client` 대신 `sendReminderPush` 사용. 멤버 쿼리에 `members.id` 추가:

```ts
private async sendGracePeriodNudge(): Promise<void> {
  try {
    const currentRound = await getCurrentRound().catch(() => null);
    if (!currentRound) return;

    const now = new Date();
    const submissionDeadline = new Date(`${currentRound.graceEndDate}T00:00:00.000+09:00`);
    const graceEnd = new Date(`${currentRound.graceEndDate}T23:59:59.999+09:00`);
    if (now <= submissionDeadline || now > graceEnd) return;

    const db = getDb();
    const pendingMembers = await db
      .select({
        id: members.id,
        nickname: members.nickname,
      })
      .from(attendance)
      .innerJoin(members, eq(attendance.memberId, members.id))
      .where(
        and(
          eq(attendance.roundId, currentRound.id),
          eq(attendance.status, AttendanceStatus.PENDING),
          eq(members.status, MemberStatus.ACTIVE),
        )
      );

    if (pendingMembers.length === 0) return;

    logger.info(`✍️ [지각 독촉] 미제출 멤버 ${pendingMembers.length}명에게 푸시 발송`);

    const memberIds = pendingMembers.map((m) => m.id);
    await sendReminderPush({
      type: 'grace_nudge',
      memberIds,
      title: '아직 시간이 있어요!',
      body: `${currentRound.roundNumber}회차 마감은 지났지만, 오늘 안에 제출하면 결석은 피할 수 있어요.`,
      clickUrl: '/dashboard',
    });
  } catch (error) {
    logger.error({ error }, '✍️ [지각 독촉] 에러');
  }
}
```

import 추가: `import { sendReminderPush } from '../lib/push-client';`
import 제거: `logNotification` (grace_nudge 로그는 웹 API가 담당)

- [ ] **Step 6: deadline-reminder.ts — sendForDDay를 푸시로 전환**

`packages/bot/src/schedulers/deadline-reminder.ts`의 `sendForDDay()` 수정.

쿼리에 `members.id` 추가, `this.client` 대신 `sendReminderPush` 사용:

```ts
private async sendForDDay(
  dDay: number,
  currentRound: { id: number; roundNumber: number; endDate: string },
): Promise<DeadlineReminderResult> {
  // ... 기존 emptyResult, message 생성 유지 ...

  const db = getDb();
  const pendingMembers = await db
    .select({
      id: members.id,
      discordId: members.discordId,
      nickname: members.nickname,
    })
    .from(attendance)
    .innerJoin(members, eq(attendance.memberId, members.id))
    .where(
      and(
        eq(attendance.roundId, currentRound.id),
        eq(attendance.status, AttendanceStatus.PENDING),
        eq(members.status, MemberStatus.ACTIVE),
      )
    );

  if (pendingMembers.length === 0) {
    logger.info({ dDay }, '📅 [마감 리마인더] 미제출 멤버 없음');
    return emptyResult();
  }

  logger.info(
    { dDay, count: pendingMembers.length },
    `📅 [마감 리마인더] D-${dDay} 미제출 멤버 ${pendingMembers.length}명에게 푸시 발송`
  );

  const memberIds = pendingMembers.map((m) => m.id);
  const pushTitle = message.title.replace(/^"|"$/g, '');
  const pushBody = message.body.join(' ').slice(0, 200);

  const result = await sendReminderPush({
    type: 'deadline_reminder',
    memberIds,
    title: pushTitle,
    body: pushBody,
    clickUrl: '/dashboard',
  });

  return {
    timestamp: new Date(),
    dDay,
    targetCount: pendingMembers.length,
    sentCount: result.success,
    failedCount: result.failed,
  };
}
```

import 추가: `import { sendReminderPush } from '../lib/push-client';`
import/사용 제거: `logNotification`, `Client` 관련 (클래스에서 `client` 프로퍼티는 레거시 호환용으로 유지하되 미사용)

- [ ] **Step 7: poll-reminder.ts — sendDMsToNonVoters를 푸시로 전환**

`packages/bot/src/schedulers/poll-reminder.ts`의 `sendDMsToNonVoters()` 수정.

쿼리에 `members.id` 추가, `sendPollReminderDM` → `sendPollReminderPush` 변경:

```ts
import { sendPollReminderPush } from '../handlers/dm-handler';

// sendDMsToNonVoters 내부:
// 개별 발송 (targetDiscordId 지정)
if (targetDiscordId) {
  const [target] = await db
    .select({ id: members.id, discordId: members.discordId, name: members.name })
    .from(members)
    .where(eq(members.discordId, targetDiscordId))
    .limit(1);

  if (!target) { /* ... 기존 에러 처리 ... */ }

  const success = await sendPollReminderPush(target.id, question, expiresAt, postId);
  return success ? { sent: 1, failed: 0 } : { sent: 0, failed: 1 };
}

// 전체 발송:
const nonVoterMembers = await db
  .select({ id: members.id, discordId: members.discordId, name: members.name })
  .from(members)
  .where(/* 기존 조건 유지 */);

let sent = 0;
let failed = 0;
for (const member of nonVoterMembers) {
  const success = await sendPollReminderPush(member.id, question, expiresAt, postId);
  if (success) sent++; else failed++;
}
return { sent, failed };
```

- [ ] **Step 8: fine-reminder.ts — sendFineReminder 호출 수정**

`packages/bot/src/schedulers/fine-reminder.ts`:

`sendFineReminder` 호출에서 `client` 제거, `discordId` → `memberId`로 변경.

`fineService.getFinesWithMemberInfo()`가 memberId를 반환하는지 확인. 반환하지 않으면 fine 레코드의 `memberId`를 직접 사용:

```ts
// 기존:
const success = await sendFineReminder(this.client, discordId, fine.id, fine.amount, fine.type as 'late' | 'absent', roundNumber, daysSinceCreation);

// 변경:
const success = await sendFineReminder(fine.memberId, fine.id, fine.amount, fine.type as 'late' | 'absent', roundNumber, daysSinceCreation);
```

`getFinesWithMemberInfo()` 반환값에서 `fine.memberId`를 사용. `discordId` 파라미터는 더 이상 불필요.

`this.client` 사용 부분도 grace nudge에서 제거되므로, `setClient()`와 `client` 프로퍼티는 유지하되 미사용 상태가 됨.

- [ ] **Step 9: handlers/index.ts export 정리**

`packages/bot/src/handlers/index.ts`에서 export 확인. `sendPollReminderDM`이 `sendPollReminderPush`로 변경되었으므로 export명도 업데이트.

- [ ] **Step 10: typecheck + 빌드**

```bash
pnpm --filter @blog-study/shared build
pnpm typecheck
pnpm --filter @blog-study/bot build
```

- [ ] **Step 11: 커밋**

```bash
git add packages/bot/src/lib/push-client.ts packages/bot/src/handlers/dm-handler.ts packages/bot/src/handlers/index.ts packages/bot/src/schedulers/fine-reminder.ts packages/bot/src/schedulers/deadline-reminder.ts packages/bot/src/schedulers/poll-reminder.ts
git commit -m "feat: Discord DM → FCM 푸시 전환 (5종)"
```

---

### Task 6: 최종 검증 + 정리

**Files:**
- Modify: `packages/bot/src/handlers/handlers.test.ts` (export 테스트 업데이트)

- [ ] **Step 1: 기존 테스트 업데이트**

`packages/bot/src/handlers/handlers.test.ts`:

`sendFineNotification`, `sendFineReminder` export 테스트의 시그니처가 변경되었으므로 (client 파라미터 제거), 테스트를 함수 존재 여부만 확인하는 방식으로 유지 (기존과 동일).

`sendPollReminderDM` → `sendPollReminderPush`로 변경된 경우 테스트도 import명 업데이트.

- [ ] **Step 2: 전체 lint + typecheck + test**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

- [ ] **Step 3: 커밋**

```bash
git add packages/bot/src/handlers/handlers.test.ts
git commit -m "test: DM→푸시 전환에 따른 테스트 업데이트"
```
