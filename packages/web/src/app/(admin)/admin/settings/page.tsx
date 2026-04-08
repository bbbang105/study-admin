'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Hash,
  RefreshCw,
  Save,
  Settings,
  Shield,
  ShieldOff,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AdminSettingsSkeleton } from '@/components/ui/page-state';

interface StudySettings {
  studyStartDate: string | null;
  totalRounds: string;
  announcementChannelId: string | null;
  noticeChannelId: string | null;
  rankingChannelId: string | null;
  popularPostsChannelId: string | null;
  botLogChannelId: string | null;
  adminNotificationChannelId: string | null;
  adminDiscordIds: string;
  studyRoleId: string | null;
}

interface RoundInfo {
  id: number;
  roundNumber: number;
  startDate: string;
  endDate: string;
  graceEndDate: string;
  isCurrent: boolean;
}

interface AdminMember {
  discordId: string;
  name: string;
  nickname: string;
  isEnv: boolean;
}

interface SettingsData {
  settings: StudySettings;
  currentRound: RoundInfo | null;
  totalRoundsCreated: number;
  adminMembers: AdminMember[];
  currentUserDiscordId: string | null;
}

export default function AdminSettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [toggling, setToggling] = useState(false);
  const [showAdvancedAdmin, setShowAdvancedAdmin] = useState(false);

  // Form state
  const [formData, setFormData] = useState<StudySettings>({
    studyStartDate: null,
    totalRounds: '10',
    announcementChannelId: null,
    noticeChannelId: null,
    rankingChannelId: null,
    popularPostsChannelId: null,
    botLogChannelId: null,
    adminNotificationChannelId: null,
    adminDiscordIds: '',
    studyRoleId: null,
  });

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const result = await response.json();
      setData(result);
      setFormData(result.settings);
    } catch (err) {
      setError('설정을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleInputChange = (key: keyof StudySettings, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value || null,
    }));
    // Clear messages on change
    setSuccessMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSuccessMessage('설정이 저장되었습니다.');
      // Refresh data
      await fetchSettings();
    } catch (err) {
      setError('설정 저장에 실패했습니다.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const currentUserDiscordId = data?.currentUserDiscordId ?? null;
  const adminMembers = data?.adminMembers ?? [];
  const isCurrentUserInConfig = adminMembers.some(
    (m) => m.discordId === currentUserDiscordId && !m.isEnv
  );
  const isCurrentUserEnvAdmin = adminMembers.some(
    (m) => m.discordId === currentUserDiscordId && m.isEnv
  );

  const handleToggleSelf = async () => {
    if (!currentUserDiscordId) return;
    try {
      setToggling(true);
      setError(null);
      setSuccessMessage(null);

      // Current config IDs from formData
      const currentIds = (formData.adminDiscordIds || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      let newIds: string[];
      if (isCurrentUserInConfig) {
        // Remove self from config
        newIds = currentIds.filter((id) => id !== currentUserDiscordId);
      } else {
        // Add self to config
        newIds = [...new Set([...currentIds, currentUserDiscordId])];
      }

      const newAdminDiscordIds = newIds.join(',');

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminDiscordIds: newAdminDiscordIds }),
      });

      if (!response.ok) throw new Error('Failed to toggle admin');

      setSuccessMessage(
        isCurrentUserInConfig ? '관리자에서 제거되었습니다.' : '관리자로 추가되었습니다.'
      );
      await fetchSettings();
    } catch (err) {
      setError('관리자 토글에 실패했습니다.');
      console.error(err);
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <AdminSettingsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">스터디 설정</h1>
          <p className="text-muted-foreground">스터디 운영에 필요한 설정을 관리하세요.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="self-start sm:self-auto">
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          저장
        </Button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">{error}</div>
      )}
      {successMessage && (
        <div className="bg-success/10 text-success px-4 py-3 rounded-lg">{successMessage}</div>
      )}

      {/* Current Round Info */}
      {data?.currentRound && (
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              현재 회차 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <div>
                <p className="text-sm text-muted-foreground">회차</p>
                <p className="text-xl font-bold">{data.currentRound.roundNumber}회차</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">시작일</p>
                <p className="font-medium">{data.currentRound.startDate}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">마감일</p>
                <p className="font-medium">{data.currentRound.endDate}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">지각 마감</p>
                <p className="font-medium">{data.currentRound.graceEndDate}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Study Schedule Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              스터디 일정
            </CardTitle>
            <CardDescription>스터디 시작일과 총 회차를 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studyStartDate">스터디 시작일</Label>
              <Input
                id="studyStartDate"
                type="date"
                value={formData.studyStartDate || ''}
                onChange={(e) => handleInputChange('studyStartDate', e.target.value)}
                placeholder="YYYY-MM-DD"
              />
              <p className="text-xs text-muted-foreground">스터디 1회차가 시작되는 월요일 날짜</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalRounds">총 회차</Label>
              <Input
                id="totalRounds"
                type="number"
                min="1"
                max="52"
                value={formData.totalRounds || '10'}
                onChange={(e) => handleInputChange('totalRounds', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                스터디 총 회차 수 (현재 {data?.totalRoundsCreated || 0}개 회차 생성됨)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Channel Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Discord 채널
            </CardTitle>
            <CardDescription>알림을 보낼 Discord 채널 ID를 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcementChannelId">새 글 알림 채널 ID</Label>
              <Input
                id="announcementChannelId"
                value={formData.announcementChannelId || ''}
                onChange={(e) => handleInputChange('announcementChannelId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                블로그 새 글 알림이 발송되는 채널 (#새-글-알림)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="noticeChannelId">공지사항 채널 ID</Label>
              <Input
                id="noticeChannelId"
                value={formData.noticeChannelId || ''}
                onChange={(e) => handleInputChange('noticeChannelId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                회차 시작/리포트가 발송되는 채널 (#공지사항)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rankingChannelId">주간 랭킹 채널 ID</Label>
              <Input
                id="rankingChannelId"
                value={formData.rankingChannelId || ''}
                onChange={(e) => handleInputChange('rankingChannelId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                주간 랭킹이 발송되는 채널 (#주간-랭킹)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="popularPostsChannelId">인기 포스트 채널 ID</Label>
              <Input
                id="popularPostsChannelId"
                value={formData.popularPostsChannelId || ''}
                onChange={(e) => handleInputChange('popularPostsChannelId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                인기 포스트 TOP 5가 발송되는 채널 (#인기-포스트)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="botLogChannelId">봇 로그 채널 ID</Label>
              <Input
                id="botLogChannelId"
                value={formData.botLogChannelId || ''}
                onChange={(e) => handleInputChange('botLogChannelId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                벌금 납부 알림 등 봇 운영 로그가 발송되는 채널 (#봇-로그)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminNotificationChannelId">관리자 알림 채널 ID</Label>
              <Input
                id="adminNotificationChannelId"
                value={formData.adminNotificationChannelId || ''}
                onChange={(e) => handleInputChange('adminNotificationChannelId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                신규 가입 승인대기 등 관리자 알림이 발송되는 채널
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Admin Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              관리자 설정
            </CardTitle>
            <CardDescription>관리자 권한을 가진 Discord 사용자를 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Admin Members List */}
            <div className="space-y-2">
              <Label>현재 관리자</Label>
              <div className="flex flex-wrap gap-2">
                {adminMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground">등록된 관리자가 없습니다.</p>
                )}
                {adminMembers.map((member) => (
                  <Badge
                    key={member.discordId}
                    variant={member.isEnv ? 'secondary' : 'default'}
                    className="gap-1 py-1 px-2.5"
                  >
                    <span>{member.name}</span>
                    {member.nickname && <span className="opacity-60">({member.nickname})</span>}
                    {member.isEnv && <span className="ml-1 text-[10px] opacity-70">환경변수</span>}
                    {member.discordId === currentUserDiscordId && (
                      <span className="ml-1 text-[10px] opacity-70">나</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Toggle Self Button */}
            {currentUserDiscordId && (
              <div>
                {isCurrentUserEnvAdmin && !isCurrentUserInConfig ? (
                  <p className="text-xs text-muted-foreground">
                    환경변수로 등록된 관리자는 웹에서 제거할 수 없습니다.
                  </p>
                ) : (
                  <Button
                    variant={isCurrentUserInConfig ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={handleToggleSelf}
                    disabled={toggling}
                  >
                    {toggling ? (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : isCurrentUserInConfig ? (
                      <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <Shield className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isCurrentUserInConfig ? '나를 관리자에서 제거' : '나를 관리자로 추가'}
                  </Button>
                )}
              </div>
            )}

            {/* Advanced: raw ID editing */}
            <div className="space-y-2">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAdvancedAdmin((prev) => !prev)}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showAdvancedAdmin ? 'rotate-180' : ''}`}
                />
                고급: ID 직접 편집
              </button>
              {showAdvancedAdmin && (
                <div className="space-y-2">
                  <Input
                    id="adminDiscordIds"
                    value={formData.adminDiscordIds || ''}
                    onChange={(e) => handleInputChange('adminDiscordIds', e.target.value)}
                    placeholder="예: 123456789,987654321"
                  />
                  <p className="text-xs text-muted-foreground">
                    쉼표로 구분하여 여러 ID 입력 가능 (config 테이블 저장용)
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="studyRoleId">스터디 역할 ID</Label>
              <Input
                id="studyRoleId"
                value={formData.studyRoleId || ''}
                onChange={(e) => handleInputChange('studyRoleId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">참가자에게 부여되는 Discord 역할</p>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              설정 안내
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>스터디 시작일</strong>을 변경하면 회차 날짜가 재계산됩니다. 기존 출석 기록에
              영향을 줄 수 있으니 주의하세요.
            </p>
            <p>
              <strong>Discord ID</strong>는 Discord 개발자 모드를 활성화한 후 사용자/채널/역할을
              우클릭하여 복사할 수 있습니다.
            </p>
            <p>
              설정 변경 후 <strong>저장</strong> 버튼을 눌러야 적용됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
