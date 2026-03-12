'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Users,
  CreditCard,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowUpRight,
  Inbox,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminDashboardSkeleton, PageError } from '@/components/ui/page-state';

interface RoundInfo {
  id: number;
  roundNumber: number;
  startDate: string;
  endDate: string;
  graceEndDate: string;
  daysRemaining: number;
  isGracePeriod: boolean;
}

interface SubmissionStats {
  total: number;
  submitted: number;
  late: number;
  absent: number;
  pending: number;
  submissionRate: number;
}

interface MemberCounts {
  active: number;
  dormant: number;
  withdrawn: number;
  total: number;
}

interface UnpaidFines {
  count: number;
  total: number;
}

interface RecentPost {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  memberNickname: string;
  memberDiscordUsername: string;
}

interface RecentAttendance {
  id: string;
  status: string;
  updatedAt: string;
  memberName: string;
  memberDiscordUsername: string;
  roundNumber: number;
}

interface AdminDashboardData {
  currentRound: RoundInfo | null;
  submissionStats: SubmissionStats | null;
  memberCounts: MemberCounts;
  totalPosts: number;
  unpaidFines: UnpaidFines;
  recentActivity: {
    posts: RecentPost[];
    attendance: RecentAttendance[];
  };
}

const statusLabels: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }
> = {
  submitted: { label: '제출', variant: 'success' },
  pending: { label: '대기', variant: 'secondary' },
  late: { label: '지각', variant: 'warning' },
  absent: { label: '결석', variant: 'destructive' },
};

function AvatarInitial({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initial}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch('/api/admin/dashboard');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError('대시보드 데이터를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) return <AdminDashboardSkeleton />;
  if (error) return <PageError message={error} />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Admin
        </p>
        <h1 className="text-lg font-semibold tracking-tight">관리자 대시보드</h1>
      </div>

      {/* Current Round Card */}
      {data?.currentRound ? (
        <Card className="border-primary/30 shadow-none">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">현재 회차</p>
              {data.currentRound.isGracePeriod ? (
                <Badge variant="warning">지각 기간</Badge>
              ) : (
                <Badge variant="default">진행 중</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">회차</p>
                <p className="text-2xl font-bold">{data.currentRound.roundNumber}회차</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">기간</p>
                <p className="hidden text-sm font-medium xl:block">
                  {data.currentRound.startDate} ~ {data.currentRound.endDate}
                </p>
                <p className="text-sm font-medium xl:hidden">
                  {data.currentRound.startDate}
                  <br />~ {data.currentRound.endDate}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">마감까지</p>
                <p className="text-2xl font-bold">
                  {data.currentRound.isGracePeriod ? (
                    <span className="text-warning">지각 마감</span>
                  ) : (
                    `${data.currentRound.daysRemaining}일`
                  )}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">제출률</p>
                <p className="text-2xl font-bold">
                  {data.submissionStats?.submissionRate ?? 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            아직 시작된 회차가 없습니다.
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <p className="text-xs text-muted-foreground">활성 참가자</p>
                <p className="text-2xl font-bold tracking-tight">{data?.memberCounts.active ?? 0}명</p>
                <p className="text-xs text-muted-foreground">
                  휴면 {data?.memberCounts.dormant ?? 0}명 · 탈퇴 {data?.memberCounts.withdrawn ?? 0}명
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <p className="text-xs text-muted-foreground">총 포스트</p>
                <p className="text-2xl font-bold tracking-tight">{data?.totalPosts ?? 0}개</p>
                <p className="text-xs text-muted-foreground">누적 작성 글</p>
              </div>
              <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                <FileText className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <p className="text-xs text-muted-foreground">미납 벌금</p>
                <p className="text-2xl font-bold tracking-tight">
                  {(data?.unpaidFines.total ?? 0).toLocaleString()}원
                </p>
                <p className="text-xs text-muted-foreground">
                  {data?.unpaidFines.count ?? 0}건 미납
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <p className="text-xs text-muted-foreground">이번 회차 현황</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="font-medium">{data?.submissionStats?.submitted ?? 0}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <span className="font-medium">{data?.submissionStats?.late ?? 0}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="font-medium">{data?.submissionStats?.absent ?? 0}</span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  대기 {data?.submissionStats?.pending ?? 0}명
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Posts */}
        <Card className="border-border/60 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between px-4 py-3 pb-0">
            <div className="space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Activity
              </p>
              <p className="text-sm font-semibold">최근 포스트</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              asChild
            >
                <Link href="/posts">
                  전체 보기
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {data?.recentActivity.posts && data.recentActivity.posts.length > 0 ? (
              <div className="divide-y divide-border/50">
                {data.recentActivity.posts.map((post) => {
                  const authorName = post.memberNickname || post.memberDiscordUsername;
                  return (
                    <div key={post.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <AvatarInitial name={authorName} />
                      <div className="min-w-0 flex-1 space-y-0.5">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-medium leading-snug hover:text-primary transition-colors"
                      >
                        {post.title}
                      </a>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{authorName}</span>
                        <span className="text-border">·</span>
                        <span>{new Date(post.publishedAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Inbox className="h-8 w-8 opacity-30" />
                <p className="text-sm">최근 포스트가 없습니다.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Attendance */}
        <Card className="border-border/60 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between px-4 py-3 pb-0">
            <div className="space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Activity
              </p>
              <p className="text-sm font-semibold">최근 출석 변경</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              asChild
            >
                <Link href="/admin/attendance">
                  전체 보기
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {data?.recentActivity.attendance && data.recentActivity.attendance.length > 0 ? (
              <div className="divide-y divide-border/50">
                {data.recentActivity.attendance.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {att.memberName || att.memberDiscordUsername}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {att.roundNumber}회차 · {new Date(att.updatedAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <Badge variant={statusLabels[att.status]?.variant ?? 'secondary'}>
                      {statusLabels[att.status]?.label ?? att.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Inbox className="h-8 w-8 opacity-30" />
                <p className="text-sm">최근 출석 변경 내역이 없습니다.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
