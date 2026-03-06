'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp, Pencil, Play, Trash2, X } from 'lucide-react';
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

interface RoundStats {
  total: number;
  submitted: number;
  late: number;
  absent: number;
  pending: number;
  submissionRate: number;
}

interface Round {
  id: number;
  roundNumber: number;
  startDate: string;
  endDate: string;
  graceEndDate: string;
  isCurrent: boolean;
  stats: RoundStats;
}

interface RoundsData {
  rounds: Round[];
  total: number;
}

export default function AdminRoundsPage() {
  const [data, setData] = useState<RoundsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    startDate: '',
    endDate: '',
    graceEndDate: '',
  });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Expanded rows (mobile)
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchRounds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/rounds');
      if (!res.ok) throw new Error('Failed to fetch rounds');
      const result = await res.json();
      setData(result.data ?? result);
      setError(null);
    } catch {
      setError('회차 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const handleSetCurrent = async (roundId: number) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCurrent: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || '현재 회차 설정 실패');
      }
      await fetchRounds();
    } catch (err) {
      setError(err instanceof Error ? err.message : '현재 회차 설정에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEdit = (round: Round) => {
    setEditingId(round.id);
    setEditForm({
      startDate: round.startDate,
      endDate: round.endDate,
      graceEndDate: round.graceEndDate,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/rounds/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || '수정 실패');
      }
      setEditingId(null);
      await fetchRounds();
    } catch (err) {
      setError(err instanceof Error ? err.message : '회차 수정에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (roundId: number) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/rounds/${roundId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || '삭제 실패');
      }
      setDeletingId(null);
      await fetchRounds();
    } catch (err) {
      setError(err instanceof Error ? err.message : '회차 삭제에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <AdminDashboardSkeleton />;
  if (error && !data) return <PageError message={error} />;

  const rounds = data?.rounds || [];
  const currentRound = rounds.find((r) => r.isCurrent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">회차 관리</h1>
          <p className="text-muted-foreground">스터디 회차를 관리하고 현재 회차를 설정합니다.</p>
        </div>
        <div className="text-sm text-muted-foreground">총 {rounds.length}개 회차</div>
      </div>

      {/* Error banner */}
      {error && data && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            닫기
          </button>
        </div>
      )}

      {/* Current Round Summary */}
      {currentRound && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">현재 회차</CardTitle>
              <Badge>진행 중</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">회차</p>
                <p className="text-2xl font-bold">{currentRound.roundNumber}회차</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">기간</p>
                <p className="text-sm font-medium">
                  {currentRound.startDate} ~ {currentRound.endDate}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">지각 마감</p>
                <p className="text-sm font-medium">{currentRound.graceEndDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">제출률</p>
                <p className="text-2xl font-bold">{currentRound.stats.submissionRate}%</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="text-success">제출 {currentRound.stats.submitted}</span>
                  <span className="text-warning">지각 {currentRound.stats.late}</span>
                  <span className="text-destructive">결석 {currentRound.stats.absent}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rounds Table */}
      {rounds.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>등록된 회차가 없습니다.</p>
              <p className="text-xs mt-1">
                설정 페이지에서 스터디를 시작하면 회차가 자동 생성됩니다.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>전체 회차</CardTitle>
            <CardDescription>
              클릭하여 회차를 수정하거나 현재 회차를 변경할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">회차</TableHead>
                    <TableHead>시작일</TableHead>
                    <TableHead>마감일</TableHead>
                    <TableHead>지각 마감</TableHead>
                    <TableHead className="text-center">제출률</TableHead>
                    <TableHead className="text-center">통계</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rounds.map((round) => {
                    const isEditing = editingId === round.id;
                    const isDeleting = deletingId === round.id;

                    return (
                      <TableRow key={round.id} className={round.isCurrent ? 'bg-primary/5' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {round.roundNumber}회차
                            {round.isCurrent && (
                              <Badge variant="default" className="text-xs">
                                현재
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input
                              type="date"
                              className="border rounded px-2 py-1 text-sm w-[140px]"
                              value={editForm.startDate}
                              onChange={(e) =>
                                setEditForm({ ...editForm, startDate: e.target.value })
                              }
                            />
                          ) : (
                            round.startDate
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input
                              type="date"
                              className="border rounded px-2 py-1 text-sm w-[140px]"
                              value={editForm.endDate}
                              onChange={(e) =>
                                setEditForm({ ...editForm, endDate: e.target.value })
                              }
                            />
                          ) : (
                            round.endDate
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input
                              type="date"
                              className="border rounded px-2 py-1 text-sm w-[140px]"
                              value={editForm.graceEndDate}
                              onChange={(e) =>
                                setEditForm({ ...editForm, graceEndDate: e.target.value })
                              }
                            />
                          ) : (
                            round.graceEndDate
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{round.stats.submissionRate}%</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5 text-xs">
                            <span className="text-success" title="제출">
                              {round.stats.submitted}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-warning" title="지각">
                              {round.stats.late}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-destructive" title="결석">
                              {round.stats.absent}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground" title="대기">
                              {round.stats.pending}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isDeleting ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-destructive mr-1">삭제?</span>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-7 w-7"
                                disabled={actionLoading}
                                onClick={() => handleDelete(round.id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setDeletingId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="default"
                                size="icon"
                                className="h-7 w-7"
                                disabled={actionLoading}
                                onClick={handleSaveEdit}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {!round.isCurrent && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="현재 회차로 설정"
                                  disabled={actionLoading}
                                  onClick={() => handleSetCurrent(round.id)}
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                title="수정"
                                onClick={() => handleStartEdit(round)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title="삭제"
                                onClick={() => setDeletingId(round.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {rounds.map((round) => {
                const isExpanded = expandedId === round.id;
                const isDeleting = deletingId === round.id;

                return (
                  <div
                    key={round.id}
                    className={`rounded-lg border p-3 ${round.isCurrent ? 'border-primary/50 bg-primary/5' : ''}`}
                  >
                    {/* Card Header */}
                    <button
                      className="flex items-center justify-between w-full text-left"
                      onClick={() => setExpandedId(isExpanded ? null : round.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{round.roundNumber}회차</span>
                        {round.isCurrent && (
                          <Badge variant="default" className="text-xs">
                            현재
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{round.stats.submissionRate}%</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Card Body */}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {round.startDate} ~ {round.endDate}
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground">지각 마감</span>
                            <p>{round.graceEndDate}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">통계</span>
                            <div className="flex gap-1.5 text-xs">
                              <span className="text-success">제출 {round.stats.submitted}</span>
                              <span className="text-warning">지각 {round.stats.late}</span>
                              <span className="text-destructive">결석 {round.stats.absent}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        {isDeleting ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-destructive">정말 삭제하시겠습니까?</span>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={actionLoading}
                              onClick={() => handleDelete(round.id)}
                            >
                              삭제
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setDeletingId(null)}
                            >
                              취소
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {!round.isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={actionLoading}
                                onClick={() => handleSetCurrent(round.id)}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                현재로 설정
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleStartEdit(round)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              수정
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => setDeletingId(round.id)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              삭제
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
