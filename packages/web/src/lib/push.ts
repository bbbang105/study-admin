import { eq, inArray, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { adminMessaging } from '@/lib/firebase/admin';
import type { MulticastMessage } from 'firebase-admin/messaging';

const { fcmTokens, notificationPreferences } = sharedDb;

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  clickUrl?: string;
  data?: Record<string, string>;
}

/**
 * 사용자 알림 설정 확인 (기본값: true)
 */
async function isNotificationEnabled(memberId: string, type: string): Promise<boolean> {
  try {
    const database = getDb();
    const pref = await database
      .select({ enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.memberId, memberId),
          eq(notificationPreferences.type, type)
        )
      )
      .limit(1);

    return pref[0]?.enabled ?? true;
  } catch {
    return true; // 에러 시 기본값 true로 알림 허용
  }
}

/**
 * 특정 멤버에게 FCM 푸시 알림 전송
 */
export async function sendPushToMember(
  memberId: string,
  payload: PushPayload
): Promise<{ success: number; failed: number }> {
  const notificationType = payload.data?.type;
  if (notificationType) {
    const enabled = await isNotificationEnabled(memberId, notificationType);
    if (!enabled) {
      return { success: 0, failed: 0 }; // 알림 끄면 전송 안 함
    }
  }

  const database = getDb();

  const tokens = await database
    .select({ token: fcmTokens.token })
    .from(fcmTokens)
    .where(eq(fcmTokens.memberId, memberId));

  if (tokens.length === 0) {
    return { success: 0, failed: 0 };
  }

  const message: MulticastMessage = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      clickUrl: payload.clickUrl || '/dashboard',
      ...payload.data,
    },
    webpush: {
      notification: {
        icon: payload.icon || '/icon-192.png',
      },
      fcmOptions: {
        link: payload.clickUrl || '/dashboard',
      },
    },
    tokens: tokens.map((t) => t.token),
  };

  try {
    const response = await adminMessaging.sendEachForMulticast(message);

    // 실패한 토큰 삭제
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp: { success: boolean }, idx: number) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]!.token);
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
    const message: MulticastMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        clickUrl: payload.clickUrl || '/dashboard',
        ...payload.data,
      },
      webpush: {
        notification: {
          icon: payload.icon || '/icon-192.png',
        },
        fcmOptions: {
          link: payload.clickUrl || '/dashboard',
        },
      },
      tokens: tokenList,
    };

    try {
      const response = await adminMessaging.sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailed += response.failureCount;

      // 실패한 토큰 삭제
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp: { success: boolean }, idx: number) => {
          if (!resp.success) {
            failedTokens.push(tokenList[idx]!);
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
    } catch (error) {
      console.error(`[push] Failed to send to ${memberId}:`, error);
      totalFailed += tokenList.length;
    }
  }

  return { success: totalSuccess, failed: totalFailed };
}
