'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Ban,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminFinesSkeleton, PageError } from '@/components/ui/page-state';

interface Fine {
  id: string;
  memberId: string;
  roundId: number;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  memberName: string;
  memberDiscordUsername: string;
  memberPart: string;
  roundNumber: number;
}

interface FineSummary {
  total: { count: number; amount: number };
  unpaid: { count: number; amount: number };
  paid: { count: number; amount: number };
  waived: { count: number; amount: number };
}

interface MemberFineSummary {
  memberId: string;
  memberName: string;
  memberDiscordUsername: string;
  memberPart: string;
  unpaidCount: number;
  unpaidAmount: number;
  totalCount: number;
  totalAmount: number;
}

interface FinesData {
  fines: Fine[];
  summary: FineSummary;
  byMember: MemberFineSummary[];
}

interface StatusConfigItem {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

const statusConfig: Record<string, StatusConfigItem> = {
  unpaid: { label: '미납', variant: 'destructive' },
  paid: { label: '납부', variant: 'success' },
  waived: { label: '면제', variant: 'secondary' },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  late: { label: '지각', color: 'text-warning' },
  absent: { label: '결석', color: 'text-destructive' },
};

export default function AdminFinesPage() {
  const [data, setData] = useState<FinesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchFines = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/fines');
      if (!response.ok) {
        throw new Error('Failed to fetch fines data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('벌금 데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFines();
  }, [fetchFines]);

  const handleMarkPaid = async (fineId: string) => {
    try {
      setUpdatingId(fineId);
      const response = await fetch(`/api/admin/fines/${fineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark fine as paid');
      }

      // Refresh data
      await fetchFines();
    } catch (err) {
      console.error('Error marking fine as paid:', err);
      alert('납부 처리에 실패했습니다.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleWaive = async (fineId: string) => {
    if (!confirm('정말 이 벌금을 면제하시겠습니까?')) {
      return;
    }

    try {
      setUpdatingId(fineId);
      const response = await fetch(`/api/admin/fines/${fineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'waived' }),
      });

      if (!response.ok) {
        throw new Error('Failed to waive fine');
      }

      // Refresh data
      await fetchFines();
    } catch (err) {
      console.error('Error waiving fine:', err);
      alert('면제 처리에 실패했습니다.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <AdminFinesSkeleton />;
  if (error) return <PageError message={error} />;

  // Filter fines
  const filteredFines = data?.fines.filter((fine) => {
    // Status filter
    if (statusFilter !== 'all' && fine.status !== statusFilter) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        fine.memberName.toLowerCase().includes(query) ||
        fine.memberDiscordUsername.toLowerCase().includes(query) ||
        fine.memberPart.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">벌금 관리</h1>
          <p className="text-muted-foreground">
            벌금 현황을 확인하고 납부/면제 처리를 하세요.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'all' ? 'border-primary' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data?.summary.total.amount ?? 0).toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.summary.total.count ?? 0}건
            </p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'unpaid' ? 'border-primary' : ''}`}
          onClick={() => setStatusFilter('unpaid')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">미납</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {(data?.summary.unpaid.amount ?? 0).toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.summary.unpaid.count ?? 0}건
            </p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'paid' ? 'border-primary' : ''}`}
          onClick={() => setStatusFilter('paid')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">납부</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {(data?.summary.paid.amount ?? 0).toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.summary.paid.count ?? 0}건
            </p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'waived' ? 'border-primary' : ''}`}
          onClick={() => setStatusFilter('waived')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">면제</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {(data?.summary.waived.amount ?? 0).toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.summary.waived.count ?? 0}건
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Member Summary (only show if there are unpaid fines) */}
      {data?.byMember && data.byMember.some((m) => m.unpaidAmount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>멤버별 미납 현황</CardTitle>
            <CardDescription>미납 벌금이 있는 멤버 목록</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.byMember
                .filter((m) => m.unpaidAmount > 0)
                .map((member) => (
                  <div
                    key={member.memberId}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{member.memberName}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.memberPart} • {member.unpaidCount}건 미납
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-destructive">
                        {member.unpaidAmount.toLocaleString()}원
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fines Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>벌금 목록</CardTitle>
              <CardDescription>
                {statusFilter === 'all' ? '전체' : statusConfig[statusFilter]?.label} 벌금 {filteredFines.length}건
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="검색..."
                  className="pl-8 w-full sm:w-[200px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filteredFines.length > 0 ? (
              filteredFines.map((fine) => (
                <div key={fine.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{fine.memberName}</p>
                      <p className="text-xs text-muted-foreground">{fine.memberPart}</p>
                    </div>
                    <Badge variant={statusConfig[fine.status]?.variant || 'secondary'} className="shrink-0">
                      {statusConfig[fine.status]?.label || fine.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    <span>{fine.roundNumber}회차</span>
                    <span>·</span>
                    <span className={typeConfig[fine.type]?.color || ''}>
                      {typeConfig[fine.type]?.label || fine.type}
                    </span>
                    <span>·</span>
                    <span className="font-medium text-foreground">{fine.amount.toLocaleString()}원</span>
                    <span>·</span>
                    <span>{new Date(fine.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {fine.status === 'unpaid' && (
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkPaid(fine.id)}
                        disabled={updatingId === fine.id}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        납부
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleWaive(fine.id)}
                        disabled={updatingId === fine.id}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        면제
                      </Button>
                    </div>
                  )}
                  {fine.status === 'paid' && fine.paidAt && (
                    <p className="text-xs text-muted-foreground pt-1">
                      {new Date(fine.paidAt).toLocaleDateString('ko-KR')} 납부
                    </p>
                  )}
                  {fine.status === 'waived' && (
                    <p className="text-xs text-muted-foreground pt-1">면제됨</p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? '검색 결과가 없습니다.' : '등록된 벌금이 없습니다.'}
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>멤버</TableHead>
                  <TableHead className="whitespace-nowrap">회차</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead className="text-right whitespace-nowrap">금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="whitespace-nowrap">생성일</TableHead>
                  <TableHead className="w-[150px]">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFines.length > 0 ? (
                  filteredFines.map((fine) => (
                    <TableRow key={fine.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium whitespace-nowrap">{fine.memberName}</div>
                          <div className="text-xs text-muted-foreground">
                            {fine.memberPart}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fine.roundNumber}회차</TableCell>
                      <TableCell>
                        <span className={typeConfig[fine.type]?.color || ''}>
                          {typeConfig[fine.type]?.label || fine.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {fine.amount.toLocaleString()}원
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={statusConfig[fine.status]?.variant || 'secondary'}>
                          {statusConfig[fine.status]?.label || fine.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {new Date(fine.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        {fine.status === 'unpaid' && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkPaid(fine.id)}
                              disabled={updatingId === fine.id}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              납부
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleWaive(fine.id)}
                              disabled={updatingId === fine.id}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              면제
                            </Button>
                          </div>
                        )}
                        {fine.status === 'paid' && fine.paidAt && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(fine.paidAt).toLocaleDateString('ko-KR')} 납부
                          </span>
                        )}
                        {fine.status === 'waived' && (
                          <span className="text-xs text-muted-foreground">면제됨</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? '검색 결과가 없습니다.' : '등록된 벌금이 없습니다.'}
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
