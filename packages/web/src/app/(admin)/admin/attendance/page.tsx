'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, XCircle } from 'lucide-react';
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
import { AdminDashboardSkeleton, PageError } from '@/components/ui/page-state';
import { MEMBER_STATUS_CONFIG } from '@/lib/member-config';

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

type DisplayRound = RoundInfo | null;

interface StatusConfigItem {
  label: string;
  icon: React.ReactNode;
  className: string;
  bgClassName: string;
}

const statusConfig = {
  SUBMITTED: {
    label: '제출',
    icon: <CheckCircle className="h-4 w-4" />,
    className: 'text-success',
    bgClassName: 'bg-success/10 dark:bg-green-900/30',
  },
  PENDING: {
    label: '대기',
    icon: <Clock className="h-4 w-4" />,
    className: 'text-muted-foreground',
    bgClassName: 'bg-muted dark:bg-gray-800/30',
  },
  LATE: {
    label: '지각',
    icon: <AlertCircle className="h-4 w-4" />,
    className: 'text-warning',
    bgClassName: 'bg-warning/10 dark:bg-yellow-900/30',
  },
  ABSENT: {
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

function getStatusConfig(status: string): StatusConfigItem {
  if (status in statusConfig) {
    return statusConfig[status as keyof typeof statusConfig];
  }
  return statusConfig.none;
}

// Number of rounds to show per page
const ROUNDS_PER_PAGE = 5;

const attendanceStatuses = [
  { value: 'SUBMITTED', label: '제출', className: 'text-success' },
  { value: 'PENDING', label: '대기', className: 'text-muted-foreground' },
  { value: 'LATE', label: '지각', className: 'text-warning' },
  { value: 'ABSENT', label: '결석', className: 'text-destructive' },
] as const;

export default function AdminAttendancePage() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (
    memberId: string,
    roundId: number,
    attendanceId: string | null,
    newStatus: string
  ) => {
    try {
      setUpdating(true);

      if (attendanceId) {
        // Update existing record
        const res = await fetch(`/api/admin/attendance/${attendanceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || err.message || '업데이트 실패');
        }
      } else {
        // Create new record
        const res = await fetch('/api/admin/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, roundId, status: newStatus }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || err.message || '생성 실패');
        }
      }

      setEditingCell(null);
      await fetchAttendance();
    } catch (err) {
      console.error('Attendance update error:', err);
      setError(err instanceof Error ? err.message : '출석 상태 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

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

  if (loading) return <AdminDashboardSkeleton />;
  if (error) return <PageError message={error} />;

  if (!data || data.rounds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">출석 현황</h1>
            <p className="text-muted-foreground">회차별 출석 현황을 확인하세요.</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">등록된 회차가 없습니다.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pagination
  const totalPages = Math.ceil(data.rounds.length / ROUNDS_PER_PAGE);
  const startIndex = currentPage * ROUNDS_PER_PAGE;
  const visibleRounds = data.rounds.slice(startIndex, startIndex + ROUNDS_PER_PAGE);
  const displayRounds: DisplayRound[] = [
    ...visibleRounds,
    ...Array.from<DisplayRound>({
      length: Math.max(0, ROUNDS_PER_PAGE - visibleRounds.length),
    }).fill(null),
  ];
  const visibleRoundStats = data.roundStats.filter((rs) =>
    visibleRounds.some((r) => r.id === rs.roundId)
  );

  // Filter members by status
  const filteredGrid =
    statusFilter === 'all'
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">출석 현황</h1>
          <p className="text-muted-foreground">
            회차별 출석 현황을 확인하세요. (멤버 × 회차 그리드)
          </p>
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">범례</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(statusConfig)
              .filter(([key]) => key !== 'none')
              .map(([key, config]) => (
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
      <div className="flex flex-wrap gap-3 md:gap-4">
        {visibleRoundStats.map((rs) => (
          <Card
            key={rs.roundId}
            className={`w-[calc(50%-0.375rem)] min-w-0 sm:w-[180px] ${rs.isCurrent ? 'border-primary' : ''}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{rs.roundNumber}회차</CardTitle>
                {rs.isCurrent && (
                  <Badge variant="default" className="text-xs">
                    현재
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                <span className="hidden xl:inline">
                  {rs.startDate} ~ {rs.endDate}
                </span>
                <span className="xl:hidden">
                  {rs.startDate}
                  <br />~ {rs.endDate}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rs.stats.submissionRate}%</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>출석 그리드</CardTitle>
              <CardDescription>
                {filteredGrid.length}명의 멤버 × {data.rounds.length}개 회차
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
                <span className="text-sm text-muted-foreground whitespace-nowrap">
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
                  {displayRounds.map((round, index) => (
                    <TableHead
                      key={round?.id ?? `empty-round-${currentPage}-${index}`}
                      className={`text-center min-w-[80px] ${round?.isCurrent ? 'bg-primary/10' : ''}`}
                    >
                      {round ? (
                        <div className="flex flex-col items-center">
                          <span className="font-medium">{round.roundNumber}회차</span>
                          <span className="text-xs text-muted-foreground">
                            {round.endDate.slice(5)}
                          </span>
                        </div>
                      ) : (
                        <div className="h-8" aria-hidden="true" />
                      )}
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
                          <div className="text-xs text-muted-foreground">{row.member.part}</div>
                        </div>
                      </TableCell>
                      <TableCell className="sticky left-[150px] bg-background z-10">
                        <Badge
                          variant={MEMBER_STATUS_CONFIG[row.member.status]?.variant || 'secondary'}
                        >
                          {MEMBER_STATUS_CONFIG[row.member.status]?.label || row.member.status}
                        </Badge>
                      </TableCell>
                      {displayRounds.map((round, index) => {
                        if (!round) {
                          return (
                            <TableCell
                              key={`empty-cell-${row.member.id}-${currentPage}-${index}`}
                              className="text-center text-muted-foreground/30"
                            >
                              -
                            </TableCell>
                          );
                        }

                        const att = row.attendance[round.id];
                        const cellConfig = getStatusConfig(att?.status || 'none');
                        const cellKey = `${row.member.id}-${round.id}`;
                        const isEditing = editingCell === cellKey;
                        return (
                          <TableCell
                            key={round.id}
                            className={`text-center relative ${round.isCurrent ? 'bg-primary/5' : ''}`}
                          >
                            {isEditing ? (
                              <div className="flex flex-col gap-1 min-w-[70px]">
                                {attendanceStatuses.map((s) => (
                                  <button
                                    key={s.value}
                                    disabled={updating}
                                    className={`text-xs px-2 py-1 rounded hover:bg-muted transition-colors ${s.className} ${att?.status === s.value ? 'font-bold bg-muted' : ''}`}
                                    onClick={() =>
                                      handleStatusChange(
                                        row.member.id,
                                        round.id,
                                        att?.id || null,
                                        s.value
                                      )
                                    }
                                  >
                                    {s.label}
                                  </button>
                                ))}
                                <button
                                  className="text-xs text-muted-foreground hover:text-foreground mt-0.5"
                                  onClick={() => setEditingCell(null)}
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                className="inline-flex items-center justify-center p-1.5 rounded cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                                title={`클릭하여 출석 상태 변경${att?.submittedAt ? ` (${new Date(att.submittedAt).toLocaleDateString('ko-KR')})` : ''}`}
                                aria-label={`${row.member.name} ${round.roundNumber}회차 출석 상태 변경`}
                                onClick={() => setEditingCell(cellKey)}
                              >
                                <div
                                  className={`inline-flex items-center justify-center p-1.5 rounded ${cellConfig.bgClassName}`}
                                >
                                  <span className={cellConfig.className}>
                                    {cellConfig.icon || '-'}
                                  </span>
                                </div>
                              </button>
                            )}
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
