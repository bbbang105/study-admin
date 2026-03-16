import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PushNotificationSettings } from '@/components/settings/push-notification-settings';

export default function ProfileNotificationsPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">알림 설정</h1>

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold leading-none tracking-tight">푸시 알림</h2>
        </CardHeader>
        <CardContent>
          <PushNotificationSettings />
        </CardContent>
      </Card>
    </div>
  );
}
