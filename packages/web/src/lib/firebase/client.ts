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

/**
 * 서비스 워커 등록
 */
async function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js',
        { type: 'classic' }
      );
      console.log('[FCM] Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('[FCM] Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

/**
 * FCM 토큰 요청
 * @returns FCM 등록 토큰 또는 null
 */
export async function requestFCMToken(): Promise<string | null> {
  try {
    // 서비스 워커 등록
    const registration = await registerServiceWorker();

    if (!registration) {
      console.error('[FCM] Service Worker registration failed');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    console.log('[FCM] Token obtained successfully');
    return token;
  } catch (error) {
    console.error('[FCM] Token request failed:', error);
    return null;
  }
}

/**
 * 포그라운드 메시지 수신 리스너
 * @param callback 메시지 수신 시 실행할 콜백 함수
 * @returns 구독 취소 함수
 */
export function onForegroundMessage(
  callback: (payload: { notification?: { title?: string; body?: string } }) => void
): () => void {
  return onMessage(messaging, callback);
}
