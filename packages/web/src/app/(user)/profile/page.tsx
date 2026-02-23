'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, Link2, FileText, CheckCircle, Calendar, Wallet, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { getPartStyle, getPartLabel } from '@/lib/part-config';

interface UserInfo {
  id: string;
  email: string;
  memberId: string | null;
}

interface MemberInfo {
  id: string;
  discordId: string;
  discordUsername: string;
  name: string;
  part: string;
  blogUrl: string;
  rssUrl: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  interests: string[] | null;
  resolution: string | null;
  onboardingCompleted: boolean;
  status: string;
  dormantUsed: boolean;
  joinedAt: string;
}

interface Stats {
  postCount: number;
  totalRounds: number;
  submittedRounds: number;
  lateRounds: number;
  absentRounds: number;
  attendanceRate: number;
  totalFines: number;
  unpaidFines: number;
}

interface ProfileData {
  user: UserInfo;
  member: MemberInfo | null;
  stats: Stats | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('프로필 정보를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">활동중</Badge>;
      case 'dormant':
        return <Badge variant="warning">휴면</Badge>;
      case 'withdrawn':
        return <Badge variant="destructive">탈퇴</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Profile
        </p>
        <h1 className="text-xl font-semibold tracking-tight">내 프로필</h1>
      </div>

      {/* Account Info */}
      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3 pb-0">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <User className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold">계정 정보</p>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 ring-2 ring-border ring-offset-2 ring-offset-background">
              <AvatarImage src={data?.member?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {(data?.member?.name || data?.user?.email || 'U').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <p className="font-semibold">
                {data?.member?.name || data?.user?.email?.split('@')[0]}
              </p>
              <p className="text-sm text-muted-foreground">{data?.user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Info or Onboarding Prompt */}
      {!data?.member ? (
        <Card className="border-border/60 shadow-none">
          <CardContent className="px-4 py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              온보딩을 완료하면 스터디원 정보가 표시됩니다.
            </p>
            <Button size="sm" onClick={() => router.push('/profile/onboarding')}>
              온보딩 시작하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Member Profile */}
          <Card className="border-border/60 shadow-none">
            <CardHeader className="px-4 py-3 pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">스터디원 정보</p>
                </div>
                {getStatusBadge(data.member.status)}
              </div>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Discord</p>
                  <p className="text-sm font-medium">{data.member.discordUsername}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">파트</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPartStyle(data.member.part).bg} ${getPartStyle(data.member.part).text}`}>
                    {getPartLabel(data.member.part)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">블로그</p>
                  <a
                    href={data.member.blogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {data.member.blogUrl}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">가입일</p>
                  <p className="text-sm font-medium">
                    {new Date(data.member.joinedAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </div>

              {data.member.bio && (
                <>
                  <Separator className="border-border/60" />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">자기소개</p>
                    <p className="text-sm">{data.member.bio}</p>
                  </div>
                </>
              )}

              {data.member.interests && data.member.interests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">관심 분야</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.member.interests.map((interest, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.member.resolution && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">다짐</p>
                  <p className="text-sm italic text-muted-foreground">&ldquo;{data.member.resolution}&rdquo;</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          {data.stats && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/60 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">작성 글</p>
                      <p className="text-2xl font-bold tracking-tight">{data.stats.postCount}개</p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">출석률</p>
                      <p className="text-2xl font-bold tracking-tight">{data.stats.attendanceRate}%</p>
                      <p className="text-xs text-muted-foreground">
                        {data.stats.submittedRounds}/{data.stats.totalRounds}회
                      </p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">지각/결석</p>
                      <p className="text-2xl font-bold tracking-tight">
                        {data.stats.lateRounds + data.stats.absentRounds}회
                      </p>
                      <p className="text-xs text-muted-foreground">
                        지각 {data.stats.lateRounds}회 / 결석 {data.stats.absentRounds}회
                      </p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Calendar className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">미납 벌금</p>
                      <p className="text-2xl font-bold tracking-tight">
                        {data.stats.unpaidFines.toLocaleString()}원
                      </p>
                      <p className="text-xs text-muted-foreground">
                        총 {data.stats.totalFines.toLocaleString()}원
                      </p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Edit Profile Button */}
          {data.member.onboardingCompleted && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => router.push('/profile/edit')}>
                프로필 수정
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
