# PWA 푸시 알림 구현 계획

## 개요

큐스팅 4th 스터디 자동화 플랫폼에 PWA 푸시 알림 기능을 추가하여 사용자에게 중요한 알림을 실시간으로 전달합니다.

**현재 상태:**
- ✅ PWA 기본 설정 완료 (manifest.json, 아이콘)
- ✅ 홈 화면 추가 지원
- ❌ 서비스 워커 미구현
- ❌ 푸시 알림 미지원

**목표:**
- Web Push API를 활용한 브라우저 푸시 알림
- 서비스 워커를 통한 백그라운드 알림 처리
- 사용자별 알림 설정 관리
- Discord 알림과 연동

---

## 기술 스택

| 항목 | 기술 | 비고 |
|------|------|------|
| 푸시 서비스 | Firebase Cloud Messaging (FCM) | 완전 무료, 무제한 |
| 서비스 워커 | Workbox + FCM SDK | Google 공식 라이브러리 |
| 알림 권한 | Notification API | 사용자 동의 필수 |
| Admin SDK | Firebase Admin SDK | 서버용 |
| 백엔드 | Next.js API Routes | Vercel 무료 플랜 |
| DB | Supabase PostgreSQL | 구독 정보 저장 (기존 활용) |

---

## 아키텍처

### 1. 푸시 알림 플로우

```
┌─────────────────┐
│  이벤트 발생     │ (게시글 작성, 댓글, 공지사항 등)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Next.js API    │ (이벤트 감지 → 대상자 추출)
│  - Routes       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Firebase Admin │ (FCM 토큰으로 메시지 전송)
│  - SDK          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FCM 서버       │ (Google 무료 인프라)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  브라우저        │ (서비스 워커 수신)
│  - Service Worker│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  사용자 기기     │ (알림 표시)
│  - Notification API
└─────────────────┘
```

### 2. 데이터베이스 스키마

```sql
-- FCM 토큰 저장 (FCM 사용 시 더 간단)
CREATE TABLE fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token TEXT NOT NULL,  -- FCM 등록 토큰
  device_info TEXT,     -- 디바이스 정보 (선택)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id, token)
);

-- 인덱스
CREATE INDEX idx_fcm_tokens_member_id ON fcm_tokens(member_id);
CREATE INDEX idx_fcm_tokens_last_used ON fcm_tokens(last_used_at);
```

---

## 구현 단계

### Phase 1: Firebase 설정 (Foundation) - 1시간

#### 1.1 Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 새 프로젝트 생성: `qscouting-4th`
3. Cloud Messaging 활성화
4. 서비스 계정 키 다운로드 (JSON)
5. 웹 앱 추가 → Firebase SDK 설정 복사

#### 1.2 의존성 설치

```bash
cd packages/web
pnpm add firebase workbox-webpack-plugin

# 서버용 Admin SDK (패키지 전체)
pnpm -W add firebase-admin
```

#### 1.3 환경 변수 설정

```bash
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=qscouting-4th.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=qscouting-4th
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=qscouting-4th.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin SDK (서버용, 절대 유출 금지)
FIREBASE_SERVICE_ACCOUNT_KEY=base64_encoded_json
```

**주의:** Admin SDK 키는 base64로 인코딩하여 환경 변수에 저장

#### 1.4 Firebase 클라이언트 초기화

```typescript
// packages/web/src/lib/firebase/client.ts
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 앱이 중복 초기화되지 않도록 체크
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const messaging = getMessaging(app);

// FCM 토큰 요청
export async function requestFCMToken() {
  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
    return token;
  } catch (error) {
    console.error('FCM token request failed:', error);
    return null;
  }
}

// 포그라운드 메시지 수신
export function onForegroundMessage(callback: (payload: any) => void) {
  return onMessage(messaging, callback);
}
```

#### 1.5 Firebase Admin SDK 초기화

```typescript
// packages/web/src/lib/firebase/admin.ts
import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

if (!getApps().length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');
  }

  const decodedKey = JSON.parse(
    Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(decodedKey as admin.ServiceAccount),
  });
}

export const adminMessaging = admin.messaging();
```

#### 1.6 서비스 워커 설정

```typescript
// packages/web/public/firebase-messaging-sw.js
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const firebaseConfig = {
  apiKey: self.env.FIREBASE_API_KEY,
  authDomain: self.env.FIREBASE_AUTH_DOMAIN,
  projectId: self.env.FIREBASE_PROJECT_ID,
  storageBucket: self.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: self.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: self.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// 백그라운드 메시지 수신
onBackgroundMessage(messaging, (payload) => {
  const notificationTitle = payload.notification?.title || '알림';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(clients.openWindow(url));
});
```

---

### Phase 2: 프론트엔드 구현 (Frontend) - 2시간

#### 2.1 푸시 알림 훅

```typescript
// packages/web/src/hooks/use-push-notification.ts
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { requestFCMToken, onForegroundMessage } from '@/lib/firebase/client';

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);

      // 포그라운드 메시지 리스너
      const unsubscribe = onForegroundMessage((payload) => {
        toast(payload.notification?.title || '알림', {
          description: payload.notification?.body,
        });
      });

      return () => unsubscribe();
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('이 브라우저는 알림을 지원하지 않습니다.');
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      const fcmToken = await requestFCMToken();
      if (fcmToken) {
        setToken(fcmToken);
        await subscribeToPush(fcmToken);
        toast.success('알림이 활성화되었습니다.');
        return true;
      }
    }

    if (result === 'denied') {
      toast.error('알림이 차단되었습니다. 브라우저 설정에서 변경해주세요.');
    }

    return false;
  };

  const subscribeToPush = async (fcmToken: string) => {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: fcmToken,
          deviceInfo: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.error('Push subscription failed:', error);
      toast.error('알림 구독에 실패했습니다.');
    }
  };

  const unsubscribe = async () => {
    if (token) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      setToken(null);
    }
  };

  return {
    permission,
    token,
    requestPermission,
    unsubscribe,
    isSupported: 'Notification' in window,
  };
}
```

#### 2.2 알림 설정 컴포넌트

```typescript
// packages/web/src/components/settings/push-notification-settings.tsx
'use client';

import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotification } from '@/hooks/use-push-notification';

export function PushNotificationSettings() {
  const { permission, token, requestPermission, unsubscribe, isSupported } = usePushNotification();

  if (!isSupported) {
    return <div className="text-sm text-muted-foreground">이 브라우저는 알림을 지원하지 않습니다.</div>;
  }

  const isEnabled = permission === 'granted' && token;

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <div className="font-medium">푸시 알림</div>
        <div className="text-sm text-muted-foreground">
          중요한 알림을 실시간으로 받아보세요.
        </div>
      </div>
      <Button
        onClick={isEnabled ? unsubscribe : requestPermission}
        variant={isEnabled ? 'outline' : 'default'}
      >
        {isEnabled ? <BellOff className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
        {isEnabled ? '알림 끄기' : '알림 켜기'}
      </Button>
    </div>
  );
}
```

---

### Phase 3: 백엔드 구현 (Backend) - 2시간

#### 3.1 DB 스키마 추가

```typescript
// packages/shared/src/db/schema.ts
export const fcmTokens = pgTable('fcm_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  deviceInfo: text('device_info'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  memberIdIdx: index('idx_fcm_tokens_member_id').on(table.memberId),
  memberTokenUnique: unique('member_token_unique').on(table.memberId, table.token),
}));
```

#### 3.2 FCM 토큰 저장 API

```typescript
// packages/web/src/app/api/push/subscribe/route.ts
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { fcmTokens } = sharedDb;

export async function POST(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { token, deviceInfo } = await request.json();

    if (!token) {
      return Errors.badRequest('FCM 토큰이 필요합니다.').toResponse();
    }

    const database = getDb();

    await database
      .insert(fcmTokens)
      .values({
        memberId: auth.memberId,
        token,
        deviceInfo,
      })
      .onConflictDoUpdate({
        target: [fcmTokens.memberId, fcmTokens.token],
        set: {
          lastUsedAt: new Date(),
          deviceInfo,
        },
      });

    return successResponse({ subscribed: true }, '알림이 구독되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
```

#### 3.3 구독 취소 API

```typescript
// packages/web/src/app/api/push/unsubscribe/route.ts
import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { fcmTokens } = sharedDb;

export async function POST(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { token } = await request.json();

    if (!token) {
      return Errors.badRequest('FCM 토큰이 필요합니다.').toResponse();
    }

    const database = getDb();

    await database
      .delete(fcmTokens)
      .where(
        and(
          eq(fcmTokens.token, token),
          eq(fcmTokens.memberId, auth.memberId)
        )
      );

    return successResponse({ unsubscribed: true }, '구독이 취소되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
```

#### 3.4 FCM 푸시 알림 전송 유틸

```typescript
// packages/web/src/lib/push.ts
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { adminMessaging } from '@/lib/firebase/admin';
import type { Message } from 'firebase-admin/messaging';

const { fcmTokens } = sharedDb;

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  clickUrl?: string;
  data?: Record<string, string>;
}

/**
 * 특정 멤버에게 FCM 푸시 알림 전송
 */
export async function sendPushToMember(
  memberId: string,
  payload: PushPayload
): Promise<{ success: number; failed: number }> {
  const database = getDb();

  const tokens = await database
    .select({ token: fcmTokens.token })
    .from(fcmTokens)
    .where(eq(fcmTokens.memberId, memberId));

  if (tokens.length === 0) {
    return { success: 0, failed: 0 };
  }

  const message: Message = {
    notification: {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
    },
    data: {
      clickUrl: payload.clickUrl || '/dashboard',
      ...payload.data,
    },
    webpush: {
      fcmOptions: {
        link: payload.clickUrl || '/dashboard',
      },
    },
    tokens: tokens.map((t) => t.token),
  };

  try {
    const response = await adminMessaging.sendMulticast(message);

    // 실패한 토큰 삭제
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx].token);
        }
      });

      if (failedTokens.length > 0) {
        await database
          .delete(fcmTokens)
          .where(inArray(fcmTokens.token, failedTokens));
      }
    }

    // 마지막 사용 시간 업데이트
    await database
      .update(fcmTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(fcmTokens.memberId, memberId));

    return {
      success: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error('[push] Failed to send:', error);
    return { success: 0, failed: tokens.length };
  }
}

/**
 * 여러 멤버에게 FCM 푸시 알림 전송
 */
export async function sendPushToMembers(
  memberIds: string[],
  payload: PushPayload
): Promise<{ success: number; failed: number }> {
  const database = getDb();

  const tokens = await database
    .select({ token: fcmTokens.token, memberId: fcmTokens.memberId })
    .from(fcmTokens)
    .where(inArray(fcmTokens.memberId, memberIds));

  if (tokens.length === 0) {
    return { success: 0, failed: 0 };
  }

  // 멤버별로 그룹화하여 전송 (FCM quota 최적화)
  const memberTokens = new Map<string, string[]>();
  tokens.forEach((t) => {
    if (!memberTokens.has(t.memberId)) {
      memberTokens.set(t.memberId, []);
    }
    memberTokens.get(t.memberId)!.push(t.token);
  });

  let totalSuccess = 0;
  let totalFailed = 0;

  // 멤버별로 전송 (중복 알림 방지)
  for (const [memberId, tokenList] of memberTokens) {
    const message: Message = {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icon-192.png',
      },
      data: {
        clickUrl: payload.clickUrl || '/dashboard',
        ...payload.data,
      },
      tokens: tokenList,
    };

    try {
      const response = await adminMessaging.sendMulticast(message);
      totalSuccess += response.successCount;
      totalFailed += response.failureCount;

      // 실패한 토큰 삭제
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokenList[idx]);
          }
        });

        if (failedTokens.length > 0) {
          await database
            .delete(fcmTokens)
            .where(inArray(fcmTokens.token, failedTokens));
        }
      }
    } catch (error) {
      console.error(`[push] Failed to send to ${memberId}:`, error);
      totalFailed += tokenList.length;
    }
  }

  return { success: totalSuccess, failed: totalFailed };
}
```

---

### Phase 4: 알림 트리거 (Notifications) - 2시간

#### 4.1 게시글 댓글 알림

```typescript
// packages/web/src/app/api/board/[id]/comments/route.ts
import { sendPushToMember } from '@/lib/push';

// 댓글 작성 후
const [newComment] = await database.insert(boardComments).values({...}).returning();

// 게시글 작성자에게 푸시 알림
if (post.memberId !== auth.memberId) {
  sendPushToMember(post.memberId, {
    title: '새 댓글이 달렸습니다',
    body: `${auth.memberName}님이 댓글을 달았습니다`,
    data: {
      url: `/board/${post.id}`,
    },
  }).catch((err) => console.error('[push] Failed:', err));
}
```

#### 4.2 게시판 게시글 알림

```typescript
// packages/web/src/app/api/board/route.ts
import { sendPushToMembers } from '@/lib/push';

// 공지사항 작성 후
if (category === 'notice') {
  // 활성 멤버 전체에게 알림
  const activeMembers = await database
    .select({ id: members.id })
    .from(members)
    .where(eq(members.status, MemberStatus.ACTIVE));

  sendPushToMembers(
    activeMembers.map((m) => m.id),
    {
      title: '📢 새 공지사항',
      body: title.trim(),
      data: {
        url: `/board/${result.id}`,
      },
    }
  ).catch((err) => console.error('[push] Failed:', err));
}
```

#### 4.3 내 게시글에 댓글 알림

```typescript
// packages/web/src/app/api/board/[id]/comments/route.ts
// 대댓글의 경우 원댓글 작성자에게도 알림
if (parentId && parent.memberId !== auth.memberId && parent.memberId !== post.memberId) {
  sendPushToMember(parent.memberId, {
    title: '💬 답글이 달렸습니다',
    body: `${auth.memberName}님이 답글을 달았습니다`,
    data: {
      url: `/board/${postId}`,
    },
  }).catch((err) => console.error('[push] Failed:', err));
}
```

---

### Phase 5: UI/UX 개선 - 1시간

#### 5.1 알림 설정 페이지 추가

```typescript
// packages/web/src/app/(user)/settings/notifications/page.tsx
export default function NotificationSettingsPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">알림 설정</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>푸시 알림</CardTitle>
          </CardHeader>
          <CardContent>
            <PushNotificationSettings />
          </CardContent>
        </Card>

        {/* 향후 확장: 카테고리별 알림 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>알림 유형</CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationTypeSettings />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

#### 5.2 환영 배너 (첫 방문시)

```typescript
// packages/web/src/components/push/push-prompt-banner.tsx
'use client';

import { Bell, X } from 'lucide-react';
import { usePushNotification } from '@/hooks/use-push-notification';

export function PushPromptBanner() {
  const { permission, requestPermission } = usePushNotification();

  if (permission !== 'default') return null;

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center gap-4">
      <Bell className="w-5 h-5 text-primary" />
      <div className="flex-1">
        <div className="font-medium">알림을 활성화하세요</div>
        <div className="text-sm text-muted-foreground">
          중요한 공지사항과 댓글을 실시간으로 받아볼 수 있습니다.
        </div>
      </div>
      <Button onClick={requestPermission} size="sm">
        활성화
      </Button>
    </div>
  );
}
```

---

## 환경 변수 설정

```bash
# .env.local (root)
# Firebase Admin SDK (base64 인코딩된 JSON)
FIREBASE_SERVICE_ACCOUNT_KEY=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAicXNjb3V0aW5nLTR0aCIsCiAgInByaXZhdGVfa2V5X2lkIjogIi4uLiIsCiAgLi4uCgp9

# packages/web/.env.local
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=qscouting-4th.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=qscouting-4th
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=qscouting-4th.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=1:...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-...
```

**주의:**
- `FIREBASE_SERVICE_ACCOUNT_KEY`는 base64로 인코딩해야 함
- 인코딩 방법: `cat service-account.json | base64 -w 0`

---

## 브라우저 지원 현황

| 브라우저 | FCM | Service Worker | 비고 |
|----------|-----|----------------|------|
| Chrome/Edge 42+ | ✅ 완전 지원 | ✅ | FCM 네이티브 |
| Firefox 44+ | ✅ 완전 지원 | ✅ | Web Push API |
| Safari 16.4+ | ⚠️ 제한적 | ✅ | iOS/macOS 별도 설정 |
| Samsung Internet | ✅ 완전 지원 | ✅ | Chromium 기반 |

**Safari 주의사항:**
- iOS 16.4+: 푸시 알림 지원 (홈 화면 추가 필요)
- macOS 13+: 지원하나 APNs 설정 필요
- FCM은 Safari에서 Web Push API를 사용

---

## 보안 고려사항

### 1. Firebase Service Account Key
- **개인키 절대 유출 금지** → Git 커밋 제외
- Base64 인코딩으로 환경 변수에 저장
- Vercel 환경 변수 설정 (서버용만)
- 클라이언트에는 공개키만 노출

### 2. FCM 토큰 보호
- 토큰은 고유 식별자로 취급
- 인증되지 않은 요청 차단
- 만료/삭제된 토큰 정리

### 3. 페이로드 보안
- 민감한 데이터는 페이로드에 포함하지 않음
- URL 데이터로만 상세 정보 전달
- 사용자 ID 대신 토큰 사용

### 4. Vercel 보안
- 서버 환경 변수만 사용
- 클라이언트에서 Admin SDK 호출 금지
- API Routes로만 FCM 전송

---

## 테스트 계획

### 1. 단위 테스트

```typescript
// packages/web/src/__tests__/push.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sendPushToMember } from '@/lib/push';

// Firebase Admin SDK mock
vi.mock('@/lib/firebase/admin', () => ({
  adminMessaging: {
    sendMulticast: vi.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    }),
  },
}));

describe('Push Notification', () => {
  it('should send FCM notification to member', async () => {
    const result = await sendPushToMember('member-id', {
      title: 'Test',
      body: 'Test notification',
    });
    expect(result.success).toBeGreaterThan(0);
  });

  it('should handle failed tokens', async () => {
    // 실패 시나리오 테스트
  });
});
```

### 2. 통합 테스트

1. **구독 흐름**
   - [ ] 알림 권한 요청
   - [ ] 구독 정보 저장
   - [ ] 구독 취소

2. **알림 수신**
   - [ ] 댓글 알림
   - [ ] 대댓글 알림
   - [ ] 공지사항 알림

3. **브라우저 테스트**
   - [ ] Chrome (Android/Desktop)
   - [ ] Safari (iOS/macOS)
   - [ ] Firefox

### 3. 부하 테스트

- 100명 동시 알림 전송
- 만료된 구독 대량 정리
- API 응답 시간 확인

---

## 롤아웃 계획

### Week 1: 개발 및 테스트
- Day 1-2: Phase 1-2 (기반 + 프론트엔드)
- Day 3-4: Phase 3 (백엔드)
- Day 5: Phase 4 (알림 트리거)

### Week 2: UI 개선 및 테스트
- Day 1: Phase 5 (UI/UX)
- Day 2-3: 통합 테스트
- Day 4: 브라우저 호환성 테스트
- Day 5: 버그 수정

### Week 3: 배포
- Day 1: dev 브랜치에 머지
- Day 2-3: 베타 테스트 (관리자 그룹)
- Day 4: 전체 사용자 롤아웃
- Day 5: 모니터링 및 피드백

---

## 성공 지표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 알림 권한 허용률 | 60% 이상 | 구독자 수 / 전체 유저 |
| 알림 도달률 | 95% 이상 | 전송 - 실패 / 전송 |
| 알림 클릭률 | 20% 이상 | 클릭 / 전송 |
| 평균 수신 시간 | 5초 이내 | 발생 - 수신 시간 차이 |

---

## 이슈 및 해결 방안

### 1. Safari 지원
- **이슈**: iOS 16.4 미만에서는 푸시 알림 미지원
- **해결**: 폴백으로 in-app 알림 표시
- **FCM**: Safari에서 Web Push API를 사용하여 자동 처리

### 2. FCM Quota 제한
- **이슈**: 무제한이지만 1회 전송에 500토큰 제한
- **해결**: `sendMulticast` 사용, 멤버별로 배치 전송

### 3. 배터리 소모
- **이슈**: 너무 잦은 알림으로 배터리 소모
- **해결**: 알림 throttle (최대 1회/5분)

### 4. Firebase 요금
- **이슈**: FCM이 정말 무료인가?
- **해결**: ✅ 완전 무료, 무제한 전송
- **단점**: Cloud Functions 사용 시 유료 가능 (여기선 사용 안 함)

---

## 향후 개선 사항

1. **알림 카테고리별 설정**
   - 게시판 댓글
   - 포스트 댓글
   - 공지사항
   - 주간 랭킹

2. **알림 예약**
   - 특정 시간대에는 알림 끄기
   - Do Not Disturb 모드

3. **알림 그룹화**
   - 같은 게시글의 댓글을 그룹화
   - "N개의 새 댓글" 표시

4. **알림 히스토리**
   - 지난 알림 목록 표시
   - 읽지 않은 알림 배지

5. **Telegram/디스코드 연동**
   - PWA 미지원 브라우저용 대안
   - 통합 알림 설정

---

## 참고 자료

### FCM 공식 문서
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [FCM Web Guide](https://firebase.google.com/docs/cloud-messaging/js/client)
- [Admin SDK Node.js](https://firebase.google.com/docs/admin/setup)
- [Send Multicast](https://firebase.google.com/docs/cloud-messaging/send-message#send-to-a-multiple-devices)

### Web API
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

### React + FCM
- [Firebase React Web Push](https://github.com/firebase/firebase-js-sdk/tree/master/packages/messaging)
- [next-firebase-messaging](https://github.com/nandorojo/next-firebase-messaging) (참고용)

---

## 총 예상 시간

- **총 8시간** (3일)
- Phase 1: 1시간
- Phase 2: 2시간
- Phase 3: 2시간
- Phase 4: 2시간
- Phase 5: 1시간
