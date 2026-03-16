'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, Crown, Medal, Minus, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, getDefaultAvatar } from '@/lib/utils';
import { PageError, RankingSkeleton } from '@/components/ui/page-state';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface WebActivityScore {
  total: number;
  message: number;
  thread: number;
  reaction: number;
  view: number;
}

interface RankingMember {
  id: string;
  name: string;
  nickname: string;
  discordUsername: string;
  profileImageUrl: string | null;
  resolution: string | null;
  postCount: number;
  attendanceRate: number;
  submittedRounds: number;
  totalRounds: number;
  currentStreak: number;
  currentRoundPosts: number;
  rankDelta: number;
  totalScore: number;
  discordScore: WebActivityScore;
}

interface CurrentRound {
  id: number;
  roundNumber: number;
}

interface RankingData {
  rankings: RankingMember[];
  totalMembers: number;
  currentUserId: string | null;
  currentRound: CurrentRound | null;
}

const TOP_N = 10;

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function RankDelta({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-500 tabular-nums">
        <TrendingUp className="h-3 w-3" />
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-rose-500 tabular-nums">
        <TrendingDown className="h-3 w-3" />
        {Math.abs(delta)}
      </span>
    );
  }
  return <Minus className="h-3 w-3 text-muted-foreground/40" />;
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500/80" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Award className="h-4 w-4 text-orange-400/80" />;
  return <span className="text-xs font-medium text-muted-foreground tabular-nums">{rank}</span>;
}

// ─────────────────────────────────────────────
// Podium Card
// ─────────────────────────────────────────────

interface PodiumCardProps {
  member: RankingMember;
  rank: 1 | 2 | 3;
  isCurrentUser: boolean;
}

function PodiumCard({ member, rank, isCurrentUser }: PodiumCardProps) {
  const displayName = member.nickname || member.discordUsername;
  const avatarFallback = displayName.slice(0, 2).toUpperCase();

  const heightClass =
    rank === 1
      ? 'min-h-[200px] sm:min-h-[280px]'
      : rank === 2
        ? 'min-h-[170px] sm:min-h-[220px]'
        : 'min-h-[150px] sm:min-h-[190px]';

  const cardClass =
    rank === 1
      ? 'bg-gradient-to-b from-yellow-50/80 to-white dark:from-yellow-950/20 dark:to-zinc-900 ring-2 ring-yellow-400/60 border-yellow-400/20 shadow-[0_0_20px_-4px_rgba(234,179,8,0.3)]'
      : 'bg-white dark:bg-zinc-900 border-border/60';

  const avatarRingClass =
    rank === 1
      ? 'ring-2 ring-yellow-400'
      : rank === 2
        ? 'ring-2 ring-slate-300 dark:ring-slate-600'
        : 'ring-2 ring-orange-300 dark:ring-orange-700';

  const PodiumIcon =
    rank === 1 ? (
      <Crown className="h-4 w-4 text-yellow-500" />
    ) : rank === 2 ? (
      <Medal className="h-4 w-4 text-slate-400" />
    ) : (
      <Award className="h-4 w-4 text-orange-400/80" />
    );

  const rankLabel = `${rank}위`;
  const rankLabelClass =
    rank === 1
      ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
      : 'bg-muted text-muted-foreground';

  return (
    <Link href={`/members/${member.id}`}>
      <Card
        className={cn(
          'relative flex flex-col items-center justify-between px-2 pb-3 pt-4 sm:px-4 sm:pb-5 sm:pt-6 shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer',
          heightClass,
          cardClass,
          isCurrentUser && 'ring-1 ring-inset ring-sky-500/30'
        )}
      >
        {isCurrentUser && (
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-medium text-white">
            나
          </span>
        )}

        {/* Rank badge */}
        <div className="flex items-center gap-1 self-start">
          {PodiumIcon}
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              rankLabelClass
            )}
          >
            {rankLabel}
          </span>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-1.5 py-2 sm:gap-2 sm:py-3">
          <Avatar className={cn('h-10 w-10 sm:h-14 sm:w-14', avatarRingClass)}>
            <AvatarImage
              src={member.profileImageUrl ?? getDefaultAvatar(member.nickname)}
              alt={displayName}
            />
            <AvatarFallback className="text-sm font-semibold">{avatarFallback}</AvatarFallback>
          </Avatar>

          <div className="text-center">
            <p className="text-xs sm:text-sm font-semibold leading-tight truncate max-w-[80px] sm:max-w-none">
              {displayName}
            </p>
            {member.resolution && (
              <p className="text-[10px] sm:text-xs text-muted-foreground italic leading-snug mt-0.5 max-w-[90px] truncate sm:max-w-[160px] sm:whitespace-normal sm:line-clamp-2">
                &ldquo;{member.resolution}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex w-full flex-col items-center gap-1.5">
          <p className="text-xl sm:text-3xl font-bold tabular-nums leading-none tracking-tight">
            {member.totalScore}
            <span className="ml-0.5 text-xs sm:text-base font-medium text-muted-foreground">
              pt
            </span>
          </p>
        </div>
      </Card>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Ranking Table Row
// ─────────────────────────────────────────────

interface RankingRowProps {
  member: RankingMember;
  rank: number;
  isMe: boolean;
  myRankGapText: string | null;
}

function RankingRow({ member, rank, isMe, myRankGapText }: RankingRowProps) {
  const displayName = member.nickname || member.discordUsername;
  const avatarFallback = displayName.slice(0, 2).toUpperCase();

  return (
    <TableRow
      className={cn(
        'relative border-border/40 hover:bg-muted/30',
        isMe && 'bg-sky-500/5 ring-1 ring-inset ring-sky-500/20'
      )}
    >
      <TableCell className="py-2.5 pl-2 sm:pl-3 whitespace-nowrap relative">
        {isMe && (
          <span className="absolute -top-2.5 left-2 z-10 rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
            내 순위
          </span>
        )}
        <div className="flex flex-col items-center gap-0.5 w-7 sm:w-8">
          <div
            className={cn(
              'flex items-center justify-center rounded-full w-7 h-7',
              rank <= 3 ? '' : 'bg-muted'
            )}
          >
            <RankIcon rank={rank} />
          </div>
          <RankDelta delta={member.rankDelta} />
        </div>
      </TableCell>

      <TableCell className="py-2.5 max-w-0">
        <Link
          href={`/members/${member.id}`}
          className="flex items-center gap-2 hover:opacity-75 transition-opacity"
        >
          <Avatar className="h-7 w-7 ring-1 ring-border shrink-0">
            <AvatarImage
              src={member.profileImageUrl ?? getDefaultAvatar(member.nickname)}
              alt={displayName}
            />
            <AvatarFallback className="text-[10px] font-medium">{avatarFallback}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="block text-sm font-medium truncate hover:underline underline-offset-4">
              {displayName}
            </span>
            {isMe && myRankGapText && (
              <span className="block text-[10px] text-sky-600/70 leading-tight mt-0.5 truncate">
                {myRankGapText}
              </span>
            )}
          </div>
        </Link>
      </TableCell>

      {/* 총점 */}
      <TableCell className="text-center py-2.5 whitespace-nowrap pr-2 sm:pr-4">
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {member.totalScore}
        </span>
        <span className="text-[10px] text-muted-foreground ml-0.5">pt</span>
      </TableCell>

      {/* 활동 상세 */}
      <TableCell className="hidden sm:table-cell py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>포스트 {member.postCount}개</span>
          <span>·</span>
          <span>포스트 조회 {member.discordScore.view}pt</span>
          <span>·</span>
          <span>포스트 댓글 {member.discordScore.thread}pt</span>
          <span>·</span>
          <span>게시글 {member.discordScore.message}pt</span>
          <span>·</span>
          <span>게시판 댓글 {member.discordScore.reaction}pt</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function RankingPage() {
  const [data, setData] = useState<RankingData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setInitialLoading(true);
        const response = await fetch('/api/ranking?sortBy=score');
        if (!response.ok) {
          throw new Error('Failed to fetch ranking data');
        }
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error ?? 'Unknown error');
        }
      } catch (err) {
        setError('랭킹 데이터를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchRanking();
  }, []);

  if (initialLoading) {
    return <RankingSkeleton />;
  }

  if (error && !data) {
    return <PageError message={error} />;
  }

  const rankings = data?.rankings ?? [];
  const currentUserId = data?.currentUserId ?? null;

  // Identify current user's rank (1-indexed)
  const myRankIndex = rankings.findIndex((m) => m.id === currentUserId);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

  // Gap to next rank
  const getMyRankGapText = (): string | null => {
    if (myRank === null) return null;
    if (myRank === 1) return '1위를 지키고 있어요';
    const me = rankings[myRankIndex];
    const above = rankings[myRankIndex - 1];
    if (!me || !above) return null;
    const gap = above.totalScore - me.totalScore;
    return gap <= 0 ? '다음 순위에 근접했어요' : `다음 순위까지 ${gap}pt`;
  };

  const myRankGapText = getMyRankGapText();

  // Reorder top 3 for podium: 2nd left, 1st center, 3rd right
  const top3 = rankings.slice(0, 3);
  const podiumOrder: (RankingMember | undefined)[] = [top3[1], top3[0], top3[2]];

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Ranking
        </p>
        <h1 className="text-xl font-semibold tracking-tight">랭킹</h1>
        <p className="text-sm text-muted-foreground">스터디원들의 활동 랭킹을 확인하세요.</p>
      </div>

      {/* ── Staggered Podium ── */}
      {top3.length >= 1 && (
        <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
          {podiumOrder.map((member, i) => {
            if (!member) {
              return <div key={i} />;
            }
            // Map display position back to actual rank
            const rank = (i === 0 ? 2 : i === 1 ? 1 : 3) as 1 | 2 | 3;
            return (
              <PodiumCard
                key={member.id}
                member={member}
                rank={rank}
                isCurrentUser={member.id === currentUserId}
              />
            );
          })}
        </div>
      )}

      {/* ── Ranking Table (Top 10 + My Rank) ── */}
      <Card className="rounded-xl border-border/60 shadow-none">
        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Top 10</span>
            </div>
            <span className="text-xs text-muted-foreground">총 {data?.totalMembers ?? 0}명</span>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-4 sm:px-4">
          {rankings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="w-12 sm:w-16 text-xs font-medium text-muted-foreground h-9 whitespace-nowrap pl-2 sm:pl-3">
                    순위
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">
                    스터디원
                  </TableHead>
                  <TableHead className="w-14 sm:w-16 text-center text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                    총점
                  </TableHead>
                  <TableHead className="hidden sm:table-cell text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                    활동 상세
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.slice(0, TOP_N).map((member, index) => (
                  <RankingRow
                    key={member.id}
                    member={member}
                    rank={index + 1}
                    isMe={member.id === currentUserId}
                    myRankGapText={member.id === currentUserId ? myRankGapText : null}
                  />
                ))}

                {/* 내가 Top 10 밖이면 구분선 + 내 순위 표시 */}
                {myRank !== null && myRank > TOP_N && myRankIndex >= 0 && rankings[myRankIndex] && (
                  <>
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell colSpan={4} className="py-1 text-center">
                        <span className="text-[10px] text-muted-foreground/60 tracking-widest">
                          ···
                        </span>
                      </TableCell>
                    </TableRow>
                    <RankingRow
                      member={rankings[myRankIndex]}
                      rank={myRank}
                      isMe
                      myRankGapText={myRankGapText}
                    />
                  </>
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Trophy className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">아직 랭킹 데이터가 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
