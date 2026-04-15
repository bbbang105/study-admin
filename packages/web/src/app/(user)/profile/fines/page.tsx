'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PageError } from '@/components/ui/page-state';

interface Fine {
  id: string;
  roundNumber: number;
  type: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'WAIVED';
  createdAt: string;
  paidAt: string | null;
}

interface Summary {
  unpaid: number;
  paid: number;
  total: number;
}

interface FinesData {
  fines: Fine[];
  summary: Summary;
}

export default function FinesPage() {
  const [data, setData] = useState<FinesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchFines = useCallback(async () => {
    try {
      const response = await fetch('/api/profile/fines');
      if (!response.ok) {
        throw new Error('Failed to fetch fines');
      }
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError('벌금 내역을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFines();
  }, [fetchFines]);

  const handlePay = async (fineId: string) => {
    setPayingId(fineId);
    try {
      const res = await fetch(`/api/fines/${fineId}/pay`, { method: 'PATCH' });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || '납부 처리에 실패했습니다.');
        setPayingId(null);
        return;
      }

      toast.success('납부가 확인되었습니다.');
      setPayingId(null);
      await fetchFines();
    } catch {
      toast.error('서버 오류가 발생했습니다. 다시 시도해주세요.');
      setPayingId(null);
    }
  };

  const getTypeLabel = (type: string) => (type === 'late' ? '지각' : '결석');

  const unpaidFines = data?.fines.filter((f) => f.status === 'PENDING') ?? [];
  const completedFines = data?.fines.filter((f) => f.status !== 'PENDING') ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Profile / Fines
        </p>
        <div className="flex items-center gap-3">
          <Link href="/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">벌금 내역</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <PageError message={error} />
      ) : (<>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-3 grid-cols-3">
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground">미납</p>
              <p className="text-lg font-bold tracking-tight text-destructive">
                {data.summary.unpaid.toLocaleString()}원
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground">납부완료</p>
              <p className="text-lg font-bold tracking-tight text-emerald-500">
                {data.summary.paid.toLocaleString()}원
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground">총 벌금</p>
              <p className="text-lg font-bold tracking-tight">
                {data.summary.total.toLocaleString()}원
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {data && data.fines.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="rounded-full bg-muted p-4">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">벌금 내역이 없습니다</p>
            <p className="text-xs text-muted-foreground">지각이나 결석 없이 잘 하고 계세요!</p>
          </div>
        </div>
      )}

      {/* Unpaid Fines */}
      {unpaidFines.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">미납 벌금</p>
          <div className="space-y-2">
            {unpaidFines.map((fine) => (
              <Card key={fine.id} className="border-border/60 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium">
                        {fine.roundNumber}회차 · {getTypeLabel(fine.type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(fine.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-bold text-destructive">
                        {fine.amount.toLocaleString()}원
                      </p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            disabled={payingId === fine.id}
                          >
                            {payingId === fine.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              '납부 완료'
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-base">
                              입금을 완료하셨나요?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm space-y-2">
                              <span className="block">
                                {fine.roundNumber}회차 {getTypeLabel(fine.type)} 벌금{' '}
                                {fine.amount.toLocaleString()}원의 납부를 확인합니다.
                              </span>
                              <span className="block text-xs rounded-md bg-muted px-2 py-1.5 font-mono">
                                카카오뱅크 3333333114501
                              </span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="h-9 text-sm">취소</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handlePay(fine.id)}
                              className="h-9 text-sm"
                            >
                              확인
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Fines */}
      {completedFines.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">처리 완료</p>
          <div className="space-y-2 opacity-70">
            {completedFines.map((fine) => (
              <Card key={fine.id} className="border-border/60 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium">
                        {fine.roundNumber}회차 · {getTypeLabel(fine.type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(fine.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-medium text-muted-foreground line-through">
                        {fine.amount.toLocaleString()}원
                      </p>
                      {fine.status === 'PAID' ? (
                        <Badge variant="success">납부완료</Badge>
                      ) : (
                        <Badge className="bg-purple-500/15 text-purple-500 hover:bg-purple-500/20 border-transparent">
                          면제
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Account Info */}
      {unpaidFines.length > 0 && (
        <Card className="border-border/60 shadow-none bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="space-y-1 flex-1">
                <p className="text-sm font-semibold">입금 계좌</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    카카오뱅크 3333333114501
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText('3333333114501');
                        toast.success('계좌번호가 복사되었습니다.');
                      } catch {
                        toast.error('복사에 실패했습니다.');
                      }
                    }}
                    className="shrink-0 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Copy className="h-3 w-3 inline mr-1" />
                    복사
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      </>)}
    </div>
  );
}
