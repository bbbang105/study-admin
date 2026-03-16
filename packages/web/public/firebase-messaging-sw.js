// Firebase Cloud Messaging Service Worker
// Firebase client API key는 설계상 공개 식별자입니다 (Security Rules + 도메인 제한으로 보호).
// https://firebase.google.com/docs/projects/api-keys#api-keys-for-firebase-are-different

const firebaseConfig = {
  apiKey: "AIzaSyB66yQiuAXxbLbWz_Cf5unRLuNvESo5sYM",
  authDomain: "kusting-159f4.firebaseapp.com",
  projectId: "kusting-159f4",
  storageBucket: "kusting-159f4.firebasestorage.app",
  messagingSenderId: "816173354609",
  appId: "1:816173354609:web:a127a7308cd35cbbaf95d0",
};

self.addEventListener('push', (event) => {
  const payload = event.data?.json();

  if (!payload) {
    return;
  }

  const notificationTitle = payload.notification?.title || '알림';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data,
    tag: payload.data?.tag || 'default',
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

// 알림 클릭 처리 — clickUrl은 반드시 상대 경로만 허용 (오픈 리다이렉트 방지)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.clickUrl || '/dashboard';
  const url = rawUrl.startsWith('/') ? rawUrl : '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
