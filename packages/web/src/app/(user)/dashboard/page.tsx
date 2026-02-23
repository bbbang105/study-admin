'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, FileText, Clock, TrendingUp, ArrowUpRight, Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RoundInfo {
  roundNumber: number;
  startDate: string;
  endDate: string;
  graceEndDate: string;
  daysRemaining: number;
  isGracePeriod: boolean;
}

interface Post {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  memberName: string;
  memberDiscordUsername: string;
}

interface DashboardData {
  currentRound: RoundInfo | null;
  recentPosts: Post[];
  totalMembers: number;
  totalPosts: number;
}

function AvatarInitial({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initial}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch('/api/dashboard');
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
          Overview
        </p>
        <h1 className="text-lg font-semibold tracking-tight">블로그 스터디 현황</h1>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* 현재 회차 */}
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">현재 회차</p>
                <p className="text-2xl font-bold tracking-tight">
                  {data?.currentRound ? `${data.currentRound.roundNumber}회차` : '-'}
                </p>
                {data?.currentRound && (
                  <p className="text-xs text-muted-foreground">
                    {data.currentRound.startDate} ~ {data.currentRound.endDate}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 마감까지 */}
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">마감까지</p>
                <p className="text-2xl font-bold tracking-tight">
                  {data?.currentRound ? (
                    data.currentRound.isGracePeriod ? (
                      <span className="text-warning">지각 기간</span>
                    ) : (
                      `${data.currentRound.daysRemaining}일`
                    )
                  ) : (
                    '-'
                  )}
                </p>
                {data?.currentRound?.isGracePeriod && (
                  <p className="text-xs text-muted-foreground">
                    지각 마감: {data.currentRound.graceEndDate}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 총 참가자 */}
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">총 참가자</p>
                <p className="text-2xl font-bold tracking-tight">
                  {data?.totalMembers ?? 0}명
                </p>
                <p className="text-xs text-muted-foreground">활성 스터디원</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 총 포스트 */}
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">총 포스트</p>
                <p className="text-2xl font-bold tracking-tight">
                  {data?.totalPosts ?? 0}개
                </p>
                <p className="text-xs text-muted-foreground">누적 작성 글</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FileText className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
          {data?.recentPosts && data.recentPosts.length > 0 ? (
            <div className="divide-y divide-border/50">
              {data.recentPosts.map((post) => {
                const authorName = post.memberName || post.memberDiscordUsername;
                return (
                  <div
                    key={post.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
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
                        <span>
                          {new Date(post.publishedAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">아직 등록된 포스트가 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
