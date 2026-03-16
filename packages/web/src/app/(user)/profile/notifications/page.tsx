import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PushNotificationSettings } from '@/components/settings/push-notification-settings';

export default function ProfileNotificationsPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">알림 설정</h1>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>푸시 알림</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PushNotificationSettings />
        </CardContent>
      </Card>
    </div>
  );
}
