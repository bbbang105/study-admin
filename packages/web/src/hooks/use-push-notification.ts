'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { onForegroundMessage, requestFCMToken } from '@/lib/firebase/client';

const PUSH_UNSUBSCRIBED_KEY = 'push-unsubscribed';

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [token, setToken] = useState<string | null>(null);

  // 권한이 granted이고 명시적으로 해제하지 않았으면 토큰 자동 복원 + 서버 재구독
  useEffect(() => {
    const unsubscribed = localStorage.getItem(PUSH_UNSUBSCRIBED_KEY) === 'true';
    if ('Notification' in window && Notification.permission === 'granted' && !unsubscribed) {
      requestFCMToken().then((fcmToken) => {
        if (fcmToken) {
          setToken(fcmToken);
          subscribeToPush(fcmToken);
        }
      });
    }
  }, []);

  useEffect(() => {
    if ('Notification' in window) {
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
        localStorage.removeItem(PUSH_UNSUBSCRIBED_KEY);
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
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: fcmToken,
          deviceInfo: navigator.userAgent.slice(0, 200),
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '구독 실패');
      }
    } catch (error) {
      console.error('Push subscription failed:', error);
      toast.error('알림 구독에 실패했습니다.');
    }
  };

  const unsubscribe = async () => {
    // 토큰이 없으면 재발급 시도 후 삭제
    let currentToken = token;
    if (!currentToken) {
      currentToken = await requestFCMToken();
    }

    if (currentToken) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentToken }),
      });
    }

    setToken(null);
    localStorage.setItem(PUSH_UNSUBSCRIBED_KEY, 'true');
    toast.success('알림이 비활성화되었습니다.');
  };

  return {
    permission,
    token,
    requestPermission,
    unsubscribe,
    isSupported: typeof window !== 'undefined' && 'Notification' in window,
  };
}
