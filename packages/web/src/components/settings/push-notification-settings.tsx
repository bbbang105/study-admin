'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Clock,
  FileText,
  MessageCircle,
  MessageSquare,
  SendHorizonal,
  Vote,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { usePushNotification } from '@/hooks/use-push-notification';

interface NotificationPreference {
  type: string;
  enabled: boolean;
}

type IconComponent = React.ComponentType<{ className?: string }>;

const NOTIFICATION_LABELS: Record<
  string,
  { label: string; icon: IconComponent; description: string }
> = {
  board_comment: {
    label: '게시판 댓글',
    icon: MessageSquare,
    description: '내 게시글에 댓글이 달릴 때',
  },
  board_reply: {
    label: '게시판 답글',
    icon: MessageCircle,
    description: '내 댓글에 답글이 달릴 때',
  },
  post_comment: {
    label: '포스트 댓글',
    icon: MessageSquare,
    description: '내 포스트에 댓글이 달릴 때',
  },
  post_reply: {
    label: '포스트 답글',
    icon: MessageCircle,
    description: '내 댓글에 답글이 달릴 때',
  },
  new_post: { label: '새 글 알림', icon: FileText, description: '스터디원이 새 글을 등록할 때' },
  fine_notification: {
    label: '벌금 알림',
    icon: Wallet,
    description: '벌금이 부과될 때',
  },
  fine_reminder: {
    label: '벌금 리마인더',
    icon: Wallet,
    description: '미납 벌금 독촉',
  },
  deadline_reminder: {
    label: '마감 리마인더',
    icon: Clock,
    description: '제출 마감 D-2/D-1/D-day',
  },
  grace_nudge: {
    label: '지각 독촉',
    icon: AlertTriangle,
    description: '지각 기간 제출 독려',
  },
  poll_reminder: {
    label: '투표 리마인더',
    icon: Vote,
    description: '투표 마감 전 참여 요청',
  },
};

export function PushNotificationSettings() {
  const { permission, token, requestPermission, unsubscribe, isSupported } = usePushNotification();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  const handleTestPush = async (type: string) => {
    setSendingTest(type);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '테스트 알림 전송에 실패했습니다.');
      }
      if (data.data?.success > 0) {
        toast.success('테스트 알림이 전송되었습니다.');
      } else {
        toast.error('알림 전송에 실패했습니다. Firebase 설정을 확인해주세요.');
      }
    } catch {
      toast.error('테스트 알림 전송에 실패했습니다.');
    } finally {
      setSendingTest(null);
    }
  };

  // 알림 설정 불러오기
  useEffect(() => {
    if (permission !== 'granted' || !token) {
      setLoading(false);
      return;
    }

    fetch('/api/notification-preferences')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPreferences(data.data);
        }
      })
      .catch(() => {
        toast.error('알림 설정을 불러오는데 실패했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [permission, token]);

  // 알림 토글
  const handleToggle = async (type: string, enabled: boolean) => {
    const snapshot = preferences;
    setPreferences((current) => current.map((p) => (p.type === type ? { ...p, enabled } : p)));

    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, enabled }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '설정 저장에 실패했습니다.');
      }

      toast.success(enabled ? '알림이 켜졌습니다.' : '알림이 꺼졌습니다.');
    } catch {
      setPreferences(snapshot);
      toast.error('설정 저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground">이 브라우저는 알림을 지원하지 않습니다.</div>
    );
  }

  const isPushEnabled = permission === 'granted' && token;

  return (
    <div className="space-y-6">
      {/* 푸시 알림 켜기/끄기 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="font-medium">푸시 알림</div>
          <div className="text-sm text-muted-foreground">
            {isPushEnabled
              ? '브라우저 알림이 활성화되어 있습니다.'
              : '중요한 알림을 실시간으로 받아보세요.'}
          </div>
        </div>
        <Button
          onClick={isPushEnabled ? unsubscribe : requestPermission}
          variant={isPushEnabled ? 'outline' : 'default'}
        >
          <Bell className="w-4 h-4 mr-2" aria-hidden="true" />
          {isPushEnabled ? '알림 끄기' : '알림 켜기'}
        </Button>
      </div>

      {/* 알림 타입별 설정 */}
      {isPushEnabled && (
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-medium">알림 종류</h3>

          {loading ? (
            <div className="text-sm text-muted-foreground" aria-live="polite">
              로딩 중…
            </div>
          ) : (
            <div className="space-y-3">
              {preferences.map((pref) => {
                const {
                  label,
                  icon: Icon,
                  description,
                } = NOTIFICATION_LABELS[pref.type] || {
                  label: pref.type,
                  icon: Bell,
                  description: '',
                };

                return (
                  <div
                    key={pref.type}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div id={`label-${pref.type}`} className="text-sm font-medium">
                          {label}
                        </div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        disabled={!pref.enabled || sendingTest === pref.type}
                        onClick={() => handleTestPush(pref.type)}
                        aria-label={`${label} 테스트 알림 보내기`}
                      >
                        <SendHorizonal
                          className={`h-4 w-4 ${sendingTest === pref.type ? 'motion-safe:animate-pulse' : ''}`}
                          aria-hidden="true"
                        />
                      </Button>
                      <Switch
                        checked={pref.enabled}
                        onCheckedChange={(checked) => handleToggle(pref.type, checked)}
                        aria-labelledby={`label-${pref.type}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
