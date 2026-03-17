import { NextResponse } from 'next/server';

const swScript = `// Firebase Cloud Messaging Service Worker (auto-generated)

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
`;

export function GET() {
  return new NextResponse(swScript, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
