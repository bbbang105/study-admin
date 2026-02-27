'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  FileText,
  Clock,
  Users,
  CreditCard,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowRight,
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
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Admin
        </p>
        <h1 className="text-xl font-semibold">관리자 대시보드</h1>
      </div>

      {/* Current Round Card */}
      {data?.currentRound && (
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
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">회차</p>
                <p className="text-2xl font-bold">{data.currentRound.roundNumber}회차</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">기간</p>
                <p className="text-sm font-medium">
                  {data.currentRound.startDate} ~ {data.currentRound.endDate}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">마감까지</p>
                <p className="text-2xl font-bold">
                  {data.currentRound.isGracePeriod ? (
                    <span className="text-warning">지각 마감</span>
                  ) : (
                    `${data.currentRound.daysRemaining}일`
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">제출률</p>
                <p className="text-2xl font-bold">
                  {data.submissionStats?.submissionRate ?? 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4 md:gap-4">
        <Card className="shadow-none border-border/60">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold">{data?.memberCounts.active ?? 0}명</div>
            <p className="text-xs text-muted-foreground mt-0.5">활성 참가자</p>
            <p className="text-xs text-muted-foreground mt-1">
              휴면 {data?.memberCounts.dormant ?? 0}명 · 탈퇴 {data?.memberCounts.withdrawn ?? 0}명
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border/60">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold">{data?.totalPosts ?? 0}개</div>
            <p className="text-xs text-muted-foreground mt-0.5">총 포스트</p>
            <p className="text-xs text-muted-foreground mt-1">누적 작성 글</p>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border/60">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold">
              {(data?.unpaidFines.total ?? 0).toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">미납 벌금</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.unpaidFines.count ?? 0}건 미납
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border/60">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">{data?.submissionStats?.submitted ?? 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">{data?.submissionStats?.late ?? 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">{data?.submissionStats?.absent ?? 0}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">이번 회차 현황</p>
            <p className="text-xs text-muted-foreground mt-1">
              대기 {data?.submissionStats?.pending ?? 0}명
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Posts */}
        <Card className="shadow-none border-border/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">최근 포스트</p>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" asChild>
                <Link href="/posts">
                  전체 보기
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data?.recentActivity.posts && data.recentActivity.posts.length > 0 ? (
              <div className="space-y-0">
                {data.recentActivity.posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start justify-between border-b border-border/40 py-2.5 last:border-0 last:pb-0 first:pt-0"
                  >
                    <div className="min-w-0 flex-1">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline truncate block text-foreground"
                      >
                        {post.title}
                      </a>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <span>{post.memberNickname || post.memberDiscordUsername}</span>
                        <span>·</span>
                        <span>{new Date(post.publishedAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                최근 포스트가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Attendance */}
        <Card className="shadow-none border-border/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">최근 출석 변경</p>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" asChild>
                <Link href="/admin/attendance">
                  전체 보기
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data?.recentActivity.attendance && data.recentActivity.attendance.length > 0 ? (
              <div className="space-y-0">
                {data.recentActivity.attendance.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between border-b border-border/40 py-2.5 last:border-0 last:pb-0 first:pt-0"
                  >
                    <div>
                      <p className="text-sm text-foreground">
                        {att.memberName || att.memberDiscordUsername}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
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
              <div className="text-center py-8 text-muted-foreground text-sm">
                최근 출석 변경 내역이 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/members">
            <Users className="h-4 w-4 mr-1.5" />
            <span className="text-sm">참가자 관리</span>
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/attendance">
            <Calendar className="h-4 w-4 mr-1.5" />
            <span className="text-sm">출석 현황</span>
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/fines">
            <CreditCard className="h-4 w-4 mr-1.5" />
            <span className="text-sm">벌금 관리</span>
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/settings">
            <Clock className="h-4 w-4 mr-1.5" />
            <span className="text-sm">설정</span>
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/curation">
            <FileText className="h-4 w-4 mr-1.5" />
            <span className="text-sm">큐레이션</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
