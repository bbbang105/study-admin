'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Clock, FileText, Inbox, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton, PageError } from '@/components/ui/page-state';
import { getDefaultAvatar, getTimeAgo } from '@/lib/utils';
import { SCORE_TYPE_MAP } from '@/lib/score-config';

interface RoundInfo {
  roundNumber: number;
  startDate: string;
  endDate: string;
  graceEndDate: string;
  daysRemaining: number;
  isGracePeriod: boolean;
  submissionRate: number;
  myAttendanceStatus: string | null;
}

interface Post {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  memberId: string | null;
  memberName: string;
  memberNickname: string | null;
  memberDiscordUsername: string;
  memberProfileImageUrl: string | null;
}

interface DashboardData {
  nickname: string | null;
  myStatus: string | null;
  currentRound: RoundInfo | null;
  recentPosts: Post[];
  totalMembers: number;
  totalPosts: number;
  memberBreakdown: { active: number; ob: number; dormant: number };
}

interface ScoreProgress {
  type: string;
  label: string;
  emoji: string;
  points: number;
  earned: number;
  dailyCap: number;
}

interface RecentScore {
  id: string;
  type: string;
  points: number;
  description: string | null;
  createdAt: string;
}

interface MyScoreData {
  totalScore: number;
  todayScore: number;
  todayProgress: ScoreProgress[];
  recentActivity: RecentScore[];
}

function getGreeting(): { emoji: string; text: string } {
  const hour = new Date().getHours();
  if (hour < 6) return { emoji: '🌙', text: '새벽까지 글쓰기, 대단해요.' };
  if (hour < 12) return { emoji: '☀️', text: '좋은 아침이에요.' };
  if (hour < 18) return { emoji: '🌤️', text: '오늘도 화이팅.' };
  return { emoji: '🌆', text: '오늘 하루도 수고했어요.' };
}

function getMotivation(
  round: RoundInfo | null,
  myStatus: string | null,
): {
  emoji: string;
  message: string;
  tone: 'chill' | 'warn' | 'urgent' | 'celebrate';
} {
  if (!round) return { emoji: '📝', message: '새 회차를 기다리는 중이에요', tone: 'chill' };

  // 활성 + 미제출(PENDING/null) 유저만 마감 압박 메시지 표시
  const isActiveAndPending =
    myStatus === 'active' &&
    (!round.myAttendanceStatus || round.myAttendanceStatus === 'PENDING');

  if (round.submissionRate >= 100) {
    return { emoji: '🎉', message: '이번 회차 전원 제출 완료! 다들 멋져요', tone: 'celebrate' };
  }
  if (isActiveAndPending && round.isGracePeriod) {
    return { emoji: '😱', message: '지각 기간이에요! 서둘러 제출해주세요', tone: 'urgent' };
  }
  if (isActiveAndPending && round.daysRemaining <= 1) {
    return { emoji: '⏰', message: '마감이 코앞이에요! 오늘 안에 제출하세요', tone: 'urgent' };
  }
  if (isActiveAndPending && round.daysRemaining <= 3) {
    return { emoji: '🔥', message: '마감이 다가오고 있어요, 슬슬 준비해볼까요?', tone: 'warn' };
  }
  if (round.submissionRate >= 80) {
    return { emoji: '💪', message: '거의 다 제출했어요! 조금만 더 힘내요', tone: 'chill' };
  }

  const chillMessages: { emoji: string; message: string }[] = [
    { emoji: '✍️', message: '완벽한 글은 없어요. 일단 쓰기 시작하면 그게 최고의 글이에요.' },
    { emoji: '🌱', message: '한 줄이라도 좋아요. 시작이 반이라잖아요.' },
    { emoji: '📝', message: '"못 쓴 글은 고칠 수도 없다." — 노라 로버츠.' },
    { emoji: '💡', message: '영감은 기다리는 게 아니라, 쓰다 보면 찾아와요.' },
    { emoji: '☕', message: '커피 한 잔이면 충분해요. 가볍게 시작해봐요.' },
    { emoji: '🐢', message: '느려도 괜찮아요. 꾸준함이 재능을 이겨요.' },
    { emoji: '🎯', message: '"완벽보다 완성이 낫다." — 셰릴 샌드버그.' },
    { emoji: '🌊', message: '첫 문장이 어색해도 괜찮아요. 다 그렇게 시작했어요.' },
    { emoji: '🧩', message: '오늘 쓴 글이 내일의 나를 만들어요.' },
    {
      emoji: '🚀',
      message: '"90% 완성해서 세상에 공유한 글이, 머릿속 100%보다 낫다." — 존 에이커프.',
    },
    { emoji: '🎨', message: '블로그는 나만의 캔버스예요. 부담 갖지 말고 자유롭게.' },
    { emoji: '📖', message: '"쓰면 쓸수록 나아진다. 가장 중요한 건 끈기다." — 옥타비아 버틀러.' },
    { emoji: '✨', message: '세상에 완벽한 초안은 없어요. 일단 써보고 다듬으면 돼요.' },
    { emoji: '🏃', message: '글쓰기 근육도 운동처럼, 꾸준히 하면 늘어요.' },
    { emoji: '🫶', message: '당신만이 쓸 수 있는 이야기가 있어요. 오늘 한 줄 남겨봐요.' },
  ];
  const idx = Math.floor(Date.now() / (1000 * 60 * 30)) % chillMessages.length; // 30분마다 변경
  const picked = chillMessages[idx] ?? chillMessages[0]!;
  return { emoji: picked.emoji, message: picked.message, tone: 'chill' as const };
}

function getDdayLabel(days: number, isGrace: boolean): string {
  if (isGrace) return '지각 마감';
  if (days <= 0) return 'D-Day';
  return `D-${days}`;
}

function getAttendanceChip(
  status: string | null,
  isGracePeriod: boolean
): { icon: string; label: string; className: string } {
  switch (status) {
    case 'SUBMITTED':
      return {
        icon: '✓',
        label: '제출 완료',
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    case 'LATE':
      return {
        icon: '△',
        label: '지각 제출',
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      };
    case 'ABSENT':
      return {
        icon: '✗',
        label: '결석',
        className: 'bg-destructive/10 text-destructive',
      };
    default:
      // PENDING or null
      if (isGracePeriod) {
        return {
          icon: '⚠',
          label: '미제출 (지각 기간)',
          className: 'bg-destructive/10 text-destructive',
        };
      }
      return {
        icon: '○',
        label: '미제출',
        className: 'bg-muted text-muted-foreground',
      };
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [scoreData, setScoreData] = useState<MyScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, scoreRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/scores/my'),
        ]);
        if (!dashRes.ok) throw new Error('Failed to fetch dashboard data');
        const dashResult = await dashRes.json();
        setData(dashResult.data ?? dashResult);

        if (scoreRes.ok) {
          const scoreResult = await scoreRes.json();
          if (scoreResult.success) setScoreData(scoreResult.data);
        }
      } catch (err) {
        setError('대시보드 데이터를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const trackPostView = useCallback((postId: string) => {
    fetch(`/api/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <PageError message={error} />;
  }

  const greeting = getGreeting();
  const motivation = getMotivation(data?.currentRound ?? null, data?.myStatus ?? null);
  const round = data?.currentRound;

  const ddayColor = round
    ? round.isGracePeriod || round.daysRemaining <= 1
      ? 'text-destructive'
      : round.daysRemaining <= 3
        ? 'text-warning'
        : 'text-primary'
    : '';

  const attendanceChip = round
    ? getAttendanceChip(round.myAttendanceStatus, round.isGracePeriod)
    : null;

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Overview
        </p>
        <h1 className="text-lg font-semibold tracking-tight">
          {greeting.emoji} {greeting.text} {data?.nickname && `${data.nickname}님`}
        </h1>
      </div>

      {/* Motivation Banner */}
      <div
        className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2.5 ${
          motivation.tone === 'celebrate'
            ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
            : motivation.tone === 'urgent'
              ? 'bg-destructive/10 text-destructive'
              : motivation.tone === 'warn'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-primary/5 text-muted-foreground'
        }`}
      >
        <span className="text-lg shrink-0">{motivation.emoji}</span>
        {motivation.message}
      </div>

      {/* Current Round Card */}
      {round ? (
        <Card className="border-primary/30 shadow-none overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{round.roundNumber}회차</p>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${ddayColor}`}>
                  {getDdayLabel(round.daysRemaining, round.isGracePeriod)}
                </span>
                {round.isGracePeriod ? (
                  <Badge variant="warning">지각 기간</Badge>
                ) : (
                  <Badge variant="default">진행 중</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {/* Period */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {round.startDate} ~ {round.endDate}
              </span>
            </div>

            {/* My Status Message (OB/Dormant) or Attendance */}
            {data?.myStatus === 'ob' ? (
              <div className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                글을 필수로 작성할 필요는 없어요. 자유롭게 활동해주세요!
              </div>
            ) : data?.myStatus === 'dormant' ? (
              <div className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                푹 쉬다가 돌아오세요 😌
              </div>
            ) : (
              <>
                {attendanceChip && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">나의 출석</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${attendanceChip.className}`}
                    >
                      {attendanceChip.icon} {attendanceChip.label}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Submission Progress (active만 표시) */}
            {data?.myStatus !== 'ob' && data?.myStatus !== 'dormant' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">제출률</p>
                  <p className="text-sm font-bold">
                    {round.submissionRate >= 100 && <span className="mr-1">🎊</span>}
                    {round.submissionRate}%
                  </p>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      round.submissionRate >= 100
                        ? 'bg-emerald-500'
                        : round.submissionRate >= 70
                          ? 'bg-primary'
                          : round.submissionRate >= 40
                            ? 'bg-amber-500'
                            : 'bg-destructive'
                    }`}
                    style={{ width: `${Math.min(round.submissionRate, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            📝 아직 시작된 회차가 없습니다.
          </CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2">
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">스터디원</p>
                <p className="text-2xl font-bold tracking-tight">
                  {data?.totalMembers ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-0.5">명</span>
                </p>
                {data?.memberBreakdown ? (
                  <p className="text-[10px] text-muted-foreground">
                    활성 {data.memberBreakdown.active} · OB {data.memberBreakdown.ob} · 휴면{' '}
                    {data.memberBreakdown.dormant}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">🏃🏻 함께 성장하는 중</p>
                )}
              </div>
              <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">누적 포스트</p>
                <p className="text-2xl font-bold tracking-tight">
                  {data?.totalPosts ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-0.5">개</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {(data?.totalPosts ?? 0) >= 100
                    ? '🏆 100개 돌파!'
                    : (data?.totalPosts ?? 0) >= 50
                      ? '💯 50개 달성!'
                      : (data?.totalPosts ?? 0) >= 30
                        ? '📚 꾸준히 쌓이는 중'
                        : '✏️ 하나씩 채워가요'}
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                <FileText className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Activity Score */}
      {scoreData && (
        <Card className="border-border/60 shadow-none">
          <CardHeader className="px-4 py-3 pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">내 활동 점수</p>
                  <p className="text-xs text-muted-foreground">
                    오늘 +{scoreData.todayScore}pt 획득
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tracking-tight tabular-nums">
                  {scoreData.totalScore.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-0.5">pt</span>
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4 space-y-4">
            {/* Today Progress */}
            <div className="grid grid-cols-2 gap-2">
              {scoreData.todayProgress.map((p) => {
                const isFull = p.earned >= p.dailyCap;
                const pct = Math.min((p.earned / p.dailyCap) * 100, 100);
                const isPostScore = p.type === 'blog_post';
                const isNonActive = data?.myStatus === 'ob' || data?.myStatus === 'dormant';
                return (
                  <div
                    key={p.type}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="text-sm shrink-0">{p.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium truncate">{p.label}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          +{p.points}pt
                        </span>
                      </div>
                      {isPostScore && isNonActive ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          활성 스터디원만 포스트 등록 점수를 받을 수 있어요.
                        </p>
                      ) : (
                        <>
                          <div
                            className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden"
                            role="progressbar"
                            aria-valuenow={p.earned}
                            aria-valuemin={0}
                            aria-valuemax={p.dailyCap}
                            aria-label={`${p.label} ${p.earned}/${p.dailyCap}`}
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isFull ? 'bg-emerald-500' : 'bg-primary'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {p.earned}/{p.dailyCap}
                            </span>
                            {isFull && <Check className="h-3 w-3 text-emerald-500" />}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Activity */}
            {scoreData.recentActivity.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    최근 활동
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2"
                    asChild
                  >
                    <Link href="/profile/activity">
                      전체보기
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    </Link>
                  </Button>
                </div>
                <div className="divide-y divide-border/40">
                  {scoreData.recentActivity.map((activity) => {
                    const typeInfo = SCORE_TYPE_MAP.get(activity.type) ?? {
                      label: activity.type,
                      emoji: '⭐',
                    };
                    const timeAgo = getTimeAgo(activity.createdAt);
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
                      >
                        <span className="text-sm shrink-0">{typeInfo.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs truncate text-foreground">
                            {activity.description || typeInfo.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
                        </div>
                        <span
                          className={`text-xs font-bold tabular-nums shrink-0 ${
                            activity.points >= 0 ? 'text-emerald-600' : 'text-rose-500'
                          }`}
                        >
                          {activity.points >= 0 ? '+' : ''}
                          {activity.points}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Posts */}
      <Card className="border-border/60 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3 pb-0">
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Posts
            </p>
            <p className="text-sm font-semibold">스터디원들의 최근 글</p>
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
              {data.recentPosts.map((post, index) => {
                const displayName =
                  post.memberNickname || post.memberName || post.memberDiscordUsername;
                const avatarSrc = post.memberProfileImageUrl || getDefaultAvatar(displayName);
                return (
                  <div key={post.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    {post.memberId ? (
                      <Link href={`/members/${post.memberId}`} className="shrink-0">
                        <Avatar className="h-8 w-8 ring-1 ring-border transition-opacity hover:opacity-80">
                          <AvatarImage src={avatarSrc} alt={displayName} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : (
                      <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-medium leading-snug hover:text-primary transition-colors"
                        onClick={() => trackPostView(post.id)}
                      >
                        {index === 0 && <span className="mr-1">🆕</span>}
                        {post.title}
                      </a>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {post.memberId ? (
                          <Link
                            href={`/members/${post.memberId}`}
                            className="hover:text-foreground transition-colors"
                          >
                            {displayName}
                          </Link>
                        ) : (
                          <span>{displayName}</span>
                        )}
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
              <p className="text-sm">아직 등록된 포스트가 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
