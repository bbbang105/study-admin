'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Crown,
  FileText,
  Medal,
  MessageCircle,
  Minus,
  Star,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
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

type AttendanceStatus = 'submitted' | 'late' | 'absent' | 'pending';

interface AttendanceRecord {
  roundNumber: number;
  status: string;
}

interface WebActivityScore {
  total: number;
  message: number;  // boardPost
  thread: number;   // postComment
  reaction: number; // boardComment
}

interface RankingMember {
  id: string;
  name: string;
  nickname: string;
  discordUsername: string;
  profileImageUrl: string | null;
  postCount: number;
  attendanceRate: number;
  submittedRounds: number;
  totalRounds: number;
  currentStreak: number;
  currentRoundPosts: number;
  attendanceHistory: AttendanceRecord[];
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

type SortKey = 'score' | 'posts' | 'activity';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SORT_TABS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  { key: 'score', label: '총점', icon: <Star className="h-3.5 w-3.5" /> },
  { key: 'posts', label: '포스트 수', icon: <FileText className="h-3.5 w-3.5" /> },
  { key: 'activity', label: '활동 점수', icon: <MessageCircle className="h-3.5 w-3.5" /> },
];

const TOP_N = 10;

/** 탭별 주요 수치 포맷 */
function getPrimaryValue(member: RankingMember, sort: SortKey): { value: string; unit: string } {
  switch (sort) {
    case 'score':
      return { value: String(member.totalScore), unit: 'pt' };
    case 'activity':
      return { value: String(member.discordScore.total), unit: 'pt' };
    case 'posts':
    default:
      return { value: String(member.postCount), unit: '개' };
  }
}

/** 탭별 부가 수치 (포디움 하단에 표시) */
function getSecondaryText(member: RankingMember, sort: SortKey): string | null {
  switch (sort) {
    case 'score':
      return `${member.postCount}개 · ${member.discordScore.total > 0 ? `활동 ${member.discordScore.total}pt` : ''}`;
    case 'activity':
      return `게시글 ${member.discordScore.message} · 댓글 ${member.discordScore.thread} · 게시판댓글 ${member.discordScore.reaction}`;
    case 'posts':
    default:
      return member.totalScore > 0 ? `${member.totalScore}pt` : null;
  }
}

const ATTENDANCE_DOT_CONFIG: Record<AttendanceStatus, { bg: string; label: string }> = {
  submitted: { bg: 'bg-emerald-500', label: '제출완료' },
  late: { bg: 'bg-yellow-400', label: '지각제출' },
  absent: { bg: 'bg-rose-400', label: '미제출' },
  pending: { bg: 'bg-muted', label: '진행중' },
};

const UNKNOWN_ATTENDANCE_DOT_CONFIG = {
  bg: 'bg-muted',
  label: '상태 미확인',
} as const;

function getAttendanceDotConfig(status: string | null | undefined) {
  if (status && status in ATTENDANCE_DOT_CONFIG) {
    return ATTENDANCE_DOT_CONFIG[status as AttendanceStatus];
  }

  return UNKNOWN_ATTENDANCE_DOT_CONFIG;
}

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

function MiniHeatmap({ history }: { history: AttendanceRecord[] }) {
  if (history.length === 0) return null;
  return (
    <div className="hidden sm:flex items-center gap-0.5">
      {history.map((record) => {
        const config = getAttendanceDotConfig(record.status);
        return (
          <span
            key={record.roundNumber}
            title={`${record.roundNumber}회차: ${config.label}`}
            className={cn('h-2.5 w-2.5 rounded-sm shrink-0', config.bg)}
          />
        );
      })}
    </div>
  );
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
  sortBy: SortKey;
}

function PodiumCard({ member, rank, isCurrentUser, sortBy }: PodiumCardProps) {
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
          </div>
        </div>

        {/* Stats — 탭별 동적 수치 */}
        {(() => {
          const primary = getPrimaryValue(member, sortBy);
          const secondary = getSecondaryText(member, sortBy);
          return (
            <div className="flex w-full flex-col items-center gap-1.5">
              <p className="text-xl sm:text-3xl font-bold tabular-nums leading-none tracking-tight">
                {primary.value}
                <span className="ml-0.5 text-xs sm:text-base font-medium text-muted-foreground">
                  {primary.unit}
                </span>
              </p>
              {secondary && (
                <span className="text-[10px] text-muted-foreground text-center leading-tight">
                  {secondary}
                </span>
              )}
            </div>
          );
        })()}
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
  sortBy: SortKey;
}

function RankingRow({ member, rank, isMe, myRankGapText, sortBy }: RankingRowProps) {
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

      {/* 주요 수치 — 탭별 동적 */}
      <TableCell className="text-center py-2.5 whitespace-nowrap pr-2 sm:pr-4">
        {(() => {
          const primary = getPrimaryValue(member, sortBy);
          return (
            <div className="flex flex-col items-center gap-0.5">
              <div>
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {primary.value}
                </span>
                <span className="text-[10px] text-muted-foreground ml-0.5">{primary.unit}</span>
              </div>
            </div>
          );
        })()}
      </TableCell>

      {/* 활동 상세 — 디스코드 활동 탭일 때만 breakdown 표시 */}
      <TableCell className="hidden sm:table-cell py-2.5 whitespace-nowrap">
        {sortBy === 'activity' ? (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span title="게시글">게시글 {member.discordScore.message}</span>
            <span>·</span>
            <span title="댓글">댓글 {member.discordScore.thread}</span>
            <span>·</span>
            <span title="게시판댓글">게시판댓글 {member.discordScore.reaction}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MiniHeatmap history={member.attendanceHistory} />
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {member.submittedRounds}/{member.totalRounds}회
            </span>
          </div>
        )}
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
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('score');

  const hasData = data !== null;

  useEffect(() => {
    const fetchRanking = async () => {
      // 초기 로드만 풀 로딩, 탭 전환은 기존 데이터 유지 + 살짝 fade
      if (!hasData) {
        setInitialLoading(true);
      } else {
        setSwitching(true);
      }
      try {
        const response = await fetch(`/api/ranking?sortBy=${sortBy}`);
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
        setSwitching(false);
      }
    };

    fetchRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

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

  // Gap to next rank for "my rank" highlight text (정렬 기준에 맞춤)
  const getMyRankGapText = (): string | null => {
    if (myRank === null) return null;
    if (myRank === 1) return '1위를 지키고 있어요';
    const me = rankings[myRankIndex];
    const above = rankings[myRankIndex - 1];
    if (!me || !above) return null;

    if (sortBy === 'activity') {
      const gap = above.discordScore.total - me.discordScore.total;
      return gap <= 0 ? '다음 순위에 근접했어요' : `다음 순위까지 ${gap}pt 활동 점수`;
    }
    if (sortBy === 'score') {
      const gap = above.totalScore - me.totalScore;
      return gap <= 0 ? '다음 순위에 근접했어요' : `다음 순위까지 ${gap}점`;
    }
    const gap = above.postCount - me.postCount;
    return gap <= 0 ? '다음 순위에 근접했어요' : `다음 순위까지 ${gap}개 포스트`;
  };

  const myRankGapText = getMyRankGapText();

  // Reorder top 3 for podium: 2nd left, 1st center, 3rd right
  const top3 = rankings.slice(0, 3);
  const podiumOrder: (RankingMember | undefined)[] = [top3[1], top3[0], top3[2]];

  return (
    <div
      className={cn(
        'space-y-6 transition-opacity duration-200',
        switching && 'opacity-50 pointer-events-none'
      )}
    >
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
                sortBy={sortBy}
              />
            );
          })}
        </div>
      )}

      {/* ── Sort Tabs ── */}
      <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 w-fit">
        {SORT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSortBy(tab.key)}
            aria-label={tab.label}
            aria-pressed={sortBy === tab.key}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs transition-all',
              sortBy === tab.key
                ? 'bg-white font-semibold text-foreground shadow-sm dark:bg-zinc-900'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

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
                    {sortBy === 'score' ? '총점' : sortBy === 'activity' ? '활동' : '포스트'}
                  </TableHead>
                  <TableHead className="hidden sm:table-cell text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                    {sortBy === 'activity' ? '활동 상세' : '출석 현황'}
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
                    sortBy={sortBy}
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
                      sortBy={sortBy}
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
