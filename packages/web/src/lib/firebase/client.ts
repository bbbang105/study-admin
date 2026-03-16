import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0]!;
  }
  return app;
}

function getMessagingInstance(): Messaging {
  if (!messagingInstance) {
    messagingInstance = getMessaging(getApp());
  }
  return messagingInstance;
}

async function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js',
        { type: 'classic' }
      );
      return registration;
    } catch (error) {
      console.error('[FCM] Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

export async function requestFCMToken(): Promise<string | null> {
  try {
    const registration = await registerServiceWorker();

    if (!registration) {
      console.error('[FCM] Service Worker registration failed');
      return null;
    }

    const token = await getToken(getMessagingInstance(), {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token;
  } catch (error) {
    console.error('[FCM] Token request failed:', error);
    return null;
  }
}

export function onForegroundMessage(
  callback: (payload: { notification?: { title?: string; body?: string } }) => void
): () => void {
  return onMessage(getMessagingInstance(), callback);
}
