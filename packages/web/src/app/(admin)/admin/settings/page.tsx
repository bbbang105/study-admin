'use client';

import { useEffect, useState, useCallback } from 'react';
import { Settings, Calendar, Hash, Users, Save, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/page-state';

interface StudySettings {
  studyStartDate: string | null;
  totalRounds: string;
  announcementChannelId: string | null;
  curationChannelId: string | null;
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

interface SettingsData {
  settings: StudySettings;
  currentRound: RoundInfo | null;
  totalRoundsCreated: number;
}

export default function AdminSettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<StudySettings>({
    studyStartDate: null,
    totalRounds: '10',
    announcementChannelId: null,
    curationChannelId: null,
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

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">스터디 설정</h1>
          <p className="text-muted-foreground">
            스터디 운영에 필요한 설정을 관리하세요.
          </p>
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
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-success/10 text-success px-4 py-3 rounded-lg">
          {successMessage}
        </div>
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
            <CardDescription>
              스터디 시작일과 총 회차를 설정합니다.
            </CardDescription>
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
              <p className="text-xs text-muted-foreground">
                스터디 1회차가 시작되는 월요일 날짜
              </p>
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
            <CardDescription>
              알림을 보낼 Discord 채널 ID를 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcementChannelId">알림 채널 ID</Label>
              <Input
                id="announcementChannelId"
                value={formData.announcementChannelId || ''}
                onChange={(e) => handleInputChange('announcementChannelId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                새 글 알림, 회차 리포트가 발송되는 채널
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="curationChannelId">큐레이션 채널 ID</Label>
              <Input
                id="curationChannelId"
                value={formData.curationChannelId || ''}
                onChange={(e) => handleInputChange('curationChannelId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                큐레이션 컨텐츠가 공유되는 채널
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
            <CardDescription>
              관리자 권한을 가진 Discord 사용자를 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminDiscordIds">관리자 Discord ID</Label>
              <Input
                id="adminDiscordIds"
                value={formData.adminDiscordIds || ''}
                onChange={(e) => handleInputChange('adminDiscordIds', e.target.value)}
                placeholder="예: 123456789,987654321"
              />
              <p className="text-xs text-muted-foreground">
                쉼표로 구분하여 여러 ID 입력 가능
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="studyRoleId">스터디 역할 ID</Label>
              <Input
                id="studyRoleId"
                value={formData.studyRoleId || ''}
                onChange={(e) => handleInputChange('studyRoleId', e.target.value)}
                placeholder="예: 1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                참가자에게 부여되는 Discord 역할
              </p>
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
              <strong>스터디 시작일</strong>을 변경하면 회차 날짜가 재계산됩니다.
              기존 출석 기록에 영향을 줄 수 있으니 주의하세요.
            </p>
            <p>
              <strong>Discord ID</strong>는 Discord 개발자 모드를 활성화한 후
              사용자/채널/역할을 우클릭하여 복사할 수 있습니다.
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
