'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowUpRight,
  Calendar,
  CheckCircle,
  ExternalLink,
  FileText,
  Github,
  Instagram,
  Link2,
  Linkedin,
  Loader2,
  LogOut,
  User,
  Wallet,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PageError, ProfileSkeleton } from '@/components/ui/page-state';
import { PartBadge } from '@/components/ui/part-badge';

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
  nickname: string;
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
  githubUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
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
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

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

  const handleWithdraw = async (e: React.MouseEvent) => {
    e.preventDefault();
    setWithdrawing(true);
    setWithdrawError(null);

    try {
      const res = await fetch('/api/profile/withdraw', { method: 'POST' });
      const result = await res.json();

      if (!res.ok) {
        setWithdrawError(result.message || '탈퇴 처리에 실패했습니다.');
        setWithdrawing(false);
        return;
      }

      setWithdrawOpen(false);
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      setWithdrawError('서버 오류가 발생했습니다. 다시 시도해주세요.');
      setWithdrawing(false);
    }
  };

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
    return <ProfileSkeleton />;
  }

  if (error) {
    return <PageError message={error} />;
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
                {(data?.member?.nickname || data?.user?.email || 'U').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <p className="font-semibold">
                {data?.member?.nickname || data?.user?.email?.split('@')[0]}
              </p>
              {data?.member?.name && (
                <p className="text-sm text-muted-foreground">{data.member.name}</p>
              )}
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
                  <p className="text-sm font-medium">
                    {data.member.discordUsername.replace(/#0$/, '')}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">파트</p>
                  <PartBadge part={data.member.part} />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">블로그</p>
                  <a
                    href={data.member.blogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline max-w-full"
                  >
                    <span className="truncate">{data.member.blogUrl}</span>
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
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      자기소개
                    </p>
                    <p className="text-sm">{data.member.bio}</p>
                  </div>
                </>
              )}

              {data.member.interests && data.member.interests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">관심 분야</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.member.interests.map((interest) => (
                      <span
                        key={interest}
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
                  <p className="text-sm italic text-muted-foreground">
                    &ldquo;{data.member.resolution}&rdquo;
                  </p>
                </div>
              )}

              {/* Social Links */}
              {(data.member.githubUrl || data.member.linkedinUrl || data.member.instagramUrl) && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">소셜 링크</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { url: data.member.githubUrl, icon: Github, label: 'GitHub' },
                      { url: data.member.linkedinUrl, icon: Linkedin, label: 'LinkedIn' },
                      { url: data.member.instagramUrl, icon: Instagram, label: 'Instagram' },
                    ]
                      .filter((link) => link.url)
                      .map((link) => {
                        const Icon = link.icon;
                        return (
                          <a
                            key={link.label}
                            href={link.url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {link.label}
                          </a>
                        );
                      })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          {data.stats && (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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
                      <p className="text-2xl font-bold tracking-tight">
                        {data.stats.attendanceRate}%
                      </p>
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

          {/* Activity History Link */}
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-0">
              <Link
                href="/profile/activity"
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">활동 내역</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  전체보기
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              </Link>
            </CardContent>
          </Card>

          {/* Edit Profile & Withdraw Buttons */}
          {data.member.onboardingCompleted && (
            <div className="flex items-center justify-between">
              <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    탈퇴하기
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent className="max-w-sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base">
                      정말 탈퇴하시겠습니까?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-muted-foreground">
                      탈퇴하면 스터디 활동이 중단되며, 다시 참가하려면 관리자 승인이 필요합니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  {withdrawError && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 border border-destructive/20">
                      {withdrawError}
                    </p>
                  )}

                  <AlertDialogFooter>
                    <AlertDialogCancel
                      disabled={withdrawing}
                      className="h-9 text-sm"
                      onClick={() => setWithdrawError(null)}
                    >
                      취소
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleWithdraw}
                      disabled={withdrawing}
                      className="h-9 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {withdrawing ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          처리 중...
                        </span>
                      ) : (
                        '탈퇴하기'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

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
