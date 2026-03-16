'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { requestFCMToken, onForegroundMessage } from '@/lib/firebase/client';

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
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
