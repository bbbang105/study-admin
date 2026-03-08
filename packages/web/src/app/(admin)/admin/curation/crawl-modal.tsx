'use client';

import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface CrawlSourceResult {
  sourceId: string;
  sourceName: string;
  success: boolean;
  itemsFound: number;
  newItemsAdded: number;
  error?: string;
}

export interface CrawlSummary {
  totalSources: number;
  totalNewItems: number;
  successCount: number;
  failCount: number;
}

export type CrawlStatus = 'idle' | 'crawling' | 'done' | 'error';

export interface CrawlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: CrawlStatus;
  totalSources: number;
  processingName: string;
  results: CrawlSourceResult[];
  summary: CrawlSummary | null;
  errorMessage: string | null;
}

export function CrawlModal({
  open,
  onOpenChange,
  status,
  totalSources,
  processingName,
  results,
  summary,
  errorMessage,
}: CrawlModalProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && status === 'crawling') return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'crawling' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {status === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            {status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
            {status === 'crawling'
              ? '크롤링 진행 중'
              : status === 'error'
                ? '크롤링 실패'
                : '크롤링 완료'}
          </DialogTitle>
          <DialogDescription>
            {status === 'crawling' && processingName && <span>{processingName} 처리 중...</span>}
            {status === 'done' && summary && (
              <span>
                {summary.totalSources}개 소스에서{' '}
                <strong className="text-primary">{summary.totalNewItems}개</strong> 새 아이템 수집
              </span>
            )}
            {status === 'error' && errorMessage}
            {errorMessage && status === 'done' && <span>{errorMessage}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        {totalSources > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {results.length} / {totalSources} 소스
              </span>
              <span>{Math.round((results.length / totalSources) * 100)}%</span>
            </div>
            <Progress value={(results.length / totalSources) * 100} className="h-2" />
          </div>
        )}

        {/* Summary Stats */}
        {status === 'done' && summary && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-muted/50 p-2.5">
              <div className="text-lg font-bold">{summary.totalSources}</div>
              <div className="text-xs text-muted-foreground">전체 소스</div>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-2.5">
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {summary.successCount}
              </div>
              <div className="text-xs text-muted-foreground">성공</div>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 p-2.5">
              <div className="text-lg font-bold text-destructive">{summary.failCount}</div>
              <div className="text-xs text-muted-foreground">실패</div>
            </div>
          </div>
        )}

        {/* Source Results List */}
        {results.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[300px] pr-1">
            {results.map((r) => (
              <div
                key={r.sourceId}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
                  r.success
                    ? 'border-border bg-background'
                    : 'border-destructive/30 bg-destructive/5'
                }`}
              >
                {r.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.sourceName}</div>
                  {r.success ? (
                    <div className="text-xs text-muted-foreground">
                      {r.itemsFound}개 발견,{' '}
                      <span className="text-primary font-medium">{r.newItemsAdded}개 추가</span>
                    </div>
                  ) : (
                    <div className="text-xs text-destructive">{r.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={status === 'crawling'}
          >
            {status === 'crawling' ? '진행 중...' : '닫기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
