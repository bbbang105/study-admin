'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RoundInfo {
  id: number;
  roundNumber: number;
  startDate: string;
  endDate: string;
  graceEndDate: string;
  isCurrent: boolean;
}

interface MemberInfo {
  id: string;
  name: string;
  discordUsername: string;
  part: string;
  status: string;
}

interface AttendanceRecord {
  id: string | null;
  status: string;
  submittedAt: string | null;
}

interface GridRow {
  member: MemberInfo;
  attendance: Record<number, AttendanceRecord>;
}

interface RoundStats {
  roundId: number;
  roundNumber: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  stats: {
    total: number;
    submitted: number;
    late: number;
    absent: number;
    pending: number;
    submissionRate: number;
  };
}

interface AttendanceData {
  rounds: RoundInfo[];
  grid: GridRow[];
  roundStats: RoundStats[];
}

interface StatusConfigItem {
  label: string;
  icon: React.ReactNode;
  className: string;
  bgClassName: string;
}

const statusConfig = {
  submitted: {
    label: '제출',
    icon: <CheckCircle className="h-4 w-4" />,
    className: 'text-success',
    bgClassName: 'bg-success/10 dark:bg-green-900/30',
  },
  pending: {
    label: '대기',
    icon: <Clock className="h-4 w-4" />,
    className: 'text-muted-foreground',
    bgClassName: 'bg-muted dark:bg-gray-800/30',
  },
  late: {
    label: '지각',
    icon: <AlertCircle className="h-4 w-4" />,
    className: 'text-warning',
    bgClassName: 'bg-warning/10 dark:bg-yellow-900/30',
  },
  absent: {
    label: '결석',
    icon: <XCircle className="h-4 w-4" />,
    className: 'text-destructive',
    bgClassName: 'bg-destructive/10 dark:bg-red-900/30',
  },
  none: {
    label: '-',
    icon: null,
    className: 'text-muted-foreground/50',
    bgClassName: '',
  },
} as const satisfies Record<string, StatusConfigItem>;

const memberStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  active: { label: '활성', variant: 'default' },
  dormant: { label: '휴면', variant: 'secondary' },
  withdrawn: { label: '탈퇴', variant: 'destructive' },
};

function getStatusConfig(status: string): StatusConfigItem {
  if (status in statusConfig) {
    return statusConfig[status as keyof typeof statusConfig];
  }
  return statusConfig.none;
}

// Number of rounds to show per page
const ROUNDS_PER_PAGE = 5;

export default function AdminAttendancePage() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/attendance');
      if (!response.ok) {
        throw new Error('Failed to fetch attendance data');
      }
      const result = await response.json();
      setData(result);
      
      // Set initial page to show current round
      if (result.rounds.length > 0) {
        const currentRoundIndex = result.rounds.findIndex((r: RoundInfo) => r.isCurrent);
        if (currentRoundIndex >= 0) {
          setCurrentPage(Math.floor(currentRoundIndex / ROUNDS_PER_PAGE));
        } else {
          // Default to last page if no current round
          setCurrentPage(Math.max(0, Math.ceil(result.rounds.length / ROUNDS_PER_PAGE) - 1));
        }
      }
    } catch (err) {
      setError('출석 데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  if (!data || data.rounds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">출석 현황</h1>
          <p className="text-muted-foreground">회차별 출석 현황을 확인하세요.</p>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              등록된 회차가 없습니다.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pagination
  const totalPages = Math.ceil(data.rounds.length / ROUNDS_PER_PAGE);
  const startIndex = currentPage * ROUNDS_PER_PAGE;
  const visibleRounds = data.rounds.slice(startIndex, startIndex + ROUNDS_PER_PAGE);
  const visibleRoundStats = data.roundStats.filter((rs) =>
    visibleRounds.some((r) => r.id === rs.roundId)
  );

  // Filter members by status
  const filteredGrid = statusFilter === 'all'
    ? data.grid
    : data.grid.filter((row) => row.member.status === statusFilter);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">출석 현황</h1>
        <p className="text-muted-foreground">
          회차별 출석 현황을 확인하세요. (멤버 × 회차 그리드)
        </p>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">범례</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(statusConfig).filter(([key]) => key !== 'none').map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`p-1 rounded ${config.bgClassName}`}>
                  <span className={config.className}>{config.icon}</span>
                </div>
                <span className="text-sm">{config.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Round Stats Summary */}
      <div className="grid gap-4 md:grid-cols-5">
        {visibleRoundStats.map((rs) => (
          <Card key={rs.roundId} className={rs.isCurrent ? 'border-primary' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {rs.roundNumber}회차
                </CardTitle>
                {rs.isCurrent && (
                  <Badge variant="default" className="text-xs">현재</Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                {rs.startDate} ~ {rs.endDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rs.stats.submissionRate}%</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="text-success">✓{rs.stats.submitted}</span>
                <span className="text-warning">△{rs.stats.late}</span>
                <span className="text-destructive">✗{rs.stats.absent}</span>
                <span className="text-muted-foreground">○{rs.stats.pending}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attendance Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>출석 그리드</CardTitle>
              <CardDescription>
                {filteredGrid.length}명의 멤버 × {data.rounds.length}개 회차
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">상태:</span>
                <select
                  className="text-sm border rounded px-2 py-1"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">전체</option>
                  <option value="active">활성</option>
                  <option value="dormant">휴면</option>
                  <option value="withdrawn">탈퇴</option>
                </select>
              </div>
              {/* Pagination */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">
                    멤버
                  </TableHead>
                  <TableHead className="sticky left-[150px] bg-background z-10 min-w-[80px]">
                    상태
                  </TableHead>
                  {visibleRounds.map((round) => (
                    <TableHead
                      key={round.id}
                      className={`text-center min-w-[80px] ${round.isCurrent ? 'bg-primary/10' : ''}`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-medium">{round.roundNumber}회차</span>
                        <span className="text-xs text-muted-foreground">
                          {round.endDate.slice(5)}
                        </span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrid.length > 0 ? (
                  filteredGrid.map((row) => (
                    <TableRow key={row.member.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        <div>
                          <div>{row.member.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.member.part}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="sticky left-[150px] bg-background z-10">
                        <Badge variant={memberStatusConfig[row.member.status]?.variant || 'secondary'}>
                          {memberStatusConfig[row.member.status]?.label || row.member.status}
                        </Badge>
                      </TableCell>
                      {visibleRounds.map((round) => {
                        const att = row.attendance[round.id];
                        const cellConfig = getStatusConfig(att?.status || 'none');
                        return (
                          <TableCell
                            key={round.id}
                            className={`text-center ${round.isCurrent ? 'bg-primary/5' : ''}`}
                          >
                            <div
                              className={`inline-flex items-center justify-center p-1.5 rounded ${cellConfig.bgClassName}`}
                              title={`${cellConfig.label}${att?.submittedAt ? ` (${new Date(att.submittedAt).toLocaleDateString('ko-KR')})` : ''}`}
                            >
                              <span className={cellConfig.className}>
                                {cellConfig.icon || '-'}
                              </span>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={visibleRounds.length + 2}
                      className="text-center py-8 text-muted-foreground"
                    >
                      표시할 멤버가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
