// Firebase Cloud Messaging Service Worker
// 이 파일은 Firebase SDK를 통해 로드됩니다

const firebaseConfig = {
  apiKey: "AIzaSyB66yQiuAXxbLbWz_Cf5unRLuNvESo5sYM",
  authDomain: "kusting-159f4.firebaseapp.com",
  projectId: "kusting-159f4",
  storageBucket: "kusting-159f4.firebasestorage.app",
  messagingSenderId: "816173354609",
  appId: "1:816173354609:web:a127a7308cd35cbbaf95d0",
};

// Firebase Messaging Service Worker는 자동으로 처리됩니다
// 이 파일은 백그라운드 메시지 수신을 위한 것입니다

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

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.clickUrl || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // 이미 열린 창이 있는 경우 포커스
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
