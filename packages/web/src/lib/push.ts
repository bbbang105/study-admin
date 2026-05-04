import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getAdminMessaging } from '@/lib/firebase/admin';
import type { MulticastMessage } from 'firebase-admin/messaging';

const { fcmTokens, notificationPreferences } = sharedDb;

/** preference 무시하고 항상 전송하는 알림 타입 */
export const FORCE_SEND_TYPES = new Set([
  'board_notice',
  'fine_notification',
  'fine_reminder',
  'deadline_reminder',
  'grace_nudge',
  'poll_reminder',
]);

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
        and(eq(notificationPreferences.memberId, memberId), eq(notificationPreferences.type, type))
      )
      .limit(1);

    return pref[0]?.enabled ?? true;
  } catch {
    return true; // 에러 시 기본값 true로 알림 허용
  }
}

export interface PushResult {
  success: number;
  failed: number;
  /** preference로 비활성한 수신자 수 */
  skipped?: number;
  /** FCM 토큰이 0개인 수신자 수 (등록 안 했거나 invalid로 삭제됨) */
  noToken?: number;
}

/**
 * 특정 멤버에게 FCM 푸시 알림 전송
 */
export async function sendPushToMember(
  memberId: string,
  payload: PushPayload
): Promise<PushResult> {
  const notificationType = payload.data?.type;
  if (notificationType && !FORCE_SEND_TYPES.has(notificationType)) {
    const enabled = await isNotificationEnabled(memberId, notificationType);
    if (!enabled) {
      return { success: 0, failed: 0, skipped: 1 };
    }
  }

  const database = getDb();

  const tokens = await database
    .select({ token: fcmTokens.token })
    .from(fcmTokens)
    .where(eq(fcmTokens.memberId, memberId));

  if (tokens.length === 0) {
    return { success: 0, failed: 0, noToken: 1 };
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

  const messaging = getAdminMessaging();
  if (!messaging) {
    console.warn('[push] Firebase Admin not initialized, skipping push');
    return { success: 0, failed: tokens.length };
  }

  try {
    const response = await messaging.sendEachForMulticast(message);

    const failedTokens: string[] = [];
    const succeededTokens: string[] = [];
    response.responses.forEach((resp: { success: boolean }, idx: number) => {
      if (resp.success) {
        succeededTokens.push(tokens[idx]!.token);
      } else {
        failedTokens.push(tokens[idx]!.token);
      }
    });

    // 실패한 토큰 삭제 (memberId 스코프)
    if (failedTokens.length > 0) {
      await database
        .delete(fcmTokens)
        .where(and(eq(fcmTokens.memberId, memberId), inArray(fcmTokens.token, failedTokens)));
    }

    // 성공한 토큰만 마지막 사용 시간 업데이트
    if (succeededTokens.length > 0) {
      await database
        .update(fcmTokens)
        .set({ lastUsedAt: new Date() })
        .where(and(eq(fcmTokens.memberId, memberId), inArray(fcmTokens.token, succeededTokens)));
    }

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
): Promise<PushResult> {
  const database = getDb();

  // 알림 설정으로 수신 거부한 멤버 필터링 (강제 전송 타입은 스킵)
  const notificationType = payload.data?.type;
  let filteredMemberIds = memberIds;
  let skipped = 0;
  if (notificationType && !FORCE_SEND_TYPES.has(notificationType)) {
    const disabledPrefs = await database
      .select({ memberId: notificationPreferences.memberId })
      .from(notificationPreferences)
      .where(
        and(
          inArray(notificationPreferences.memberId, memberIds),
          eq(notificationPreferences.type, notificationType),
          eq(notificationPreferences.enabled, false)
        )
      );
    const disabledSet = new Set(disabledPrefs.map((p) => p.memberId));
    filteredMemberIds = memberIds.filter((id) => !disabledSet.has(id));
    skipped = memberIds.length - filteredMemberIds.length;
  }

  if (filteredMemberIds.length === 0) {
    return { success: 0, failed: 0, skipped, noToken: 0 };
  }

  const tokens = await database
    .select({ token: fcmTokens.token, memberId: fcmTokens.memberId })
    .from(fcmTokens)
    .where(inArray(fcmTokens.memberId, filteredMemberIds));

  const memberIdsWithToken = new Set(tokens.map((t) => t.memberId));
  const noToken = filteredMemberIds.filter((id) => !memberIdsWithToken.has(id)).length;

  if (tokens.length === 0) {
    return { success: 0, failed: 0, skipped, noToken };
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
      const messaging = getAdminMessaging();
      if (!messaging) {
        totalFailed += tokenList.length;
        continue;
      }

      const response = await messaging.sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailed += response.failureCount;

      const failedTokens: string[] = [];
      const succeededTokens: string[] = [];
      response.responses.forEach((resp: { success: boolean }, idx: number) => {
        if (resp.success) {
          succeededTokens.push(tokenList[idx]!);
        } else {
          failedTokens.push(tokenList[idx]!);
        }
      });

      // 실패한 토큰 삭제 (memberId 스코프)
      if (failedTokens.length > 0) {
        await database
          .delete(fcmTokens)
          .where(and(eq(fcmTokens.memberId, memberId), inArray(fcmTokens.token, failedTokens)));
      }

      // 성공한 토큰만 마지막 사용 시간 업데이트
      if (succeededTokens.length > 0) {
        await database
          .update(fcmTokens)
          .set({ lastUsedAt: new Date() })
          .where(and(eq(fcmTokens.memberId, memberId), inArray(fcmTokens.token, succeededTokens)));
      }
    } catch (error) {
      console.error(`[push] Failed to send to ${memberId}:`, error);
      totalFailed += tokenList.length;
    }
  }

  return { success: totalSuccess, failed: totalFailed, skipped, noToken };
}
