'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Medal, Award, FileText, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getDefaultAvatar } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
}

interface RankingData {
  rankings: RankingMember[];
  totalMembers: number;
}

const PODIUM_CONFIG = [
  {
    rank: 1,
    icon: <Trophy className="h-4 w-4 text-yellow-500/80" />,
    label: '1위',
    cardClass: 'ring-2 ring-yellow-400/40 border-yellow-400/20 shadow-none',
    labelClass: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
  },
  {
    rank: 2,
    icon: <Medal className="h-4 w-4 text-slate-400" />,
    label: '2위',
    cardClass: 'border-border/50 shadow-none',
    labelClass: 'bg-muted text-muted-foreground',
  },
  {
    rank: 3,
    icon: <Award className="h-4 w-4 text-orange-400/80" />,
    label: '3위',
    cardClass: 'border-border/50 shadow-none',
    labelClass: 'bg-muted text-muted-foreground',
  },
] as const;

export default function RankingPage() {
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'posts' | 'attendance'>('posts');

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/ranking?sortBy=${sortBy}`);
        if (!response.ok) {
          throw new Error('Failed to fetch ranking data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError('랭킹 데이터를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [sortBy]);

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-4 w-4 text-yellow-500/80" />;
      case 2:
        return <Medal className="h-4 w-4 text-slate-400" />;
      case 3:
        return <Award className="h-4 w-4 text-orange-400/80" />;
      default:
        return (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {rank}
          </span>
        );
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
      {/* Page header */}
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ranking</p>
        <h1 className="text-xl font-semibold tracking-tight">랭킹</h1>
        <p className="text-sm text-muted-foreground">
          스터디원들의 활동 랭킹을 확인하세요.
        </p>
      </div>

      {/* Top 3 podium cards */}
      {data?.rankings && data.rankings.length >= 3 && (
        <div className="grid gap-3 md:grid-cols-3">
          {data.rankings.slice(0, 3).map((member, index) => {
            const config = PODIUM_CONFIG[index]!;
            return (
              <Card key={member.id} className={config.cardClass}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {config.icon}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.labelClass}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Link
                    href={`/members/${member.id}`}
                    className="flex items-center gap-3 hover:opacity-75 transition-opacity"
                  >
                    <Avatar className="h-10 w-10 ring-2 ring-border">
                      <AvatarImage src={member.profileImageUrl || getDefaultAvatar(member.nickname)} />
                      <AvatarFallback className="text-xs font-medium">
                        {(member.nickname || member.discordUsername).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.nickname || member.discordUsername}
                      </p>
                      <div className="flex items-center gap-2.5 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {member.postCount}개
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {member.attendanceRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sort toggle */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortBy('posts')}
          className={`h-7 px-3 text-xs gap-1.5 ${
            sortBy === 'posts'
              ? 'bg-muted text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-3 w-3" />
          포스트 수
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortBy('attendance')}
          className={`h-7 px-3 text-xs gap-1.5 ${
            sortBy === 'attendance'
              ? 'bg-muted text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckCircle className="h-3 w-3" />
          출석률
        </Button>
      </div>

      {/* Full ranking table */}
      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-3 pt-5 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">전체 랭킹</span>
            </div>
            <span className="text-xs text-muted-foreground">
              총 {data?.totalMembers ?? 0}명
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          {data?.rankings && data.rankings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="w-[72px] text-xs font-medium text-muted-foreground h-9">순위</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">스터디원</TableHead>
                  <TableHead className="text-center text-xs font-medium text-muted-foreground h-9">포스트</TableHead>
                  <TableHead className="text-center text-xs font-medium text-muted-foreground h-9">출석률</TableHead>
                  <TableHead className="text-center text-xs font-medium text-muted-foreground h-9">출석 현황</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rankings.map((member, index) => (
                  <TableRow key={member.id} className="border-border/40 hover:bg-muted/30">
                    <TableCell className="py-2.5">
                      <div className="flex items-center justify-center bg-muted rounded-full w-7 h-7">
                        {getRankDisplay(index + 1)}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Link
                        href={`/members/${member.id}`}
                        className="flex items-center gap-2.5 hover:opacity-75 transition-opacity"
                      >
                        <Avatar className="h-7 w-7 ring-1 ring-border">
                          <AvatarImage src={member.profileImageUrl || getDefaultAvatar(member.nickname)} />
                          <AvatarFallback className="text-[10px] font-medium">
                            {(member.nickname || member.discordUsername).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium hover:underline underline-offset-4">
                          {member.nickname || member.discordUsername}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center py-2.5">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {member.postCount}개
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-2.5">
                      <Badge
                        variant={
                          member.attendanceRate >= 80
                            ? 'success'
                            : member.attendanceRate >= 50
                            ? 'warning'
                            : 'destructive'
                        }
                      >
                        {member.attendanceRate.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center py-2.5 text-sm text-muted-foreground tabular-nums">
                      {member.submittedRounds}/{member.totalRounds}회
                    </TableCell>
                  </TableRow>
                ))}
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
