'use client';

import { useEffect, useState } from 'react';
import { BotOperationCard } from '@/components/bot-operation-card';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BotOperation {
  id: string;
  name: string;
  description: string;
  category: string;
  schedule: string;
  running: boolean;
}

export default function BotOperationsPage() {
  const [operations, setOperations] = useState<BotOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [triggeringOperationId, setTriggeringOperationId] = useState<string | null>(null);

  const fetchOperations = async () => {
    try {
      const response = await fetch('/api/admin/bot-operations');
      if (!response.ok) {
        throw new Error('작업 목록을 불러오는데 실패했습니다');
      }
      const json = await response.json();
      const operations = json.data?.operations ?? [];
      setOperations(operations);
    } catch (error) {
      console.error('Failed to fetch operations:', error);
      toast.error('작업 목록을 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOperations();
  };

  const handleTrigger = async (operationId: string) => {
    setTriggeringOperationId(operationId);
    try {
      const response = await fetch(`/api/admin/bot-operations/${operationId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || '작업 실행에 실패했습니다');
      }

      // Update the operation status to running
      setOperations((prev) =>
        prev.map((op) =>
          op.id === operationId ? { ...op, running: true } : op
        )
      );

      // Refresh after a delay to get updated status
      setTimeout(() => {
        fetchOperations();
      }, 2000);
    } catch (error) {
      console.error('Failed to trigger operation:', error);
      throw error;
    } finally {
      setTriggeringOperationId(null);
    }
  };

  useEffect(() => {
    fetchOperations();
    // Refresh every 30 seconds to update running status
    const interval = setInterval(fetchOperations, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">봇 동작 제어</h1>
          <p className="text-muted-foreground mt-2">
            스케줄된 작업을 수동으로 실행하고 상태를 모니터링합니다
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
        {operations.map((operation) => (
          <BotOperationCard
            key={operation.id}
            operation={operation}
            onTrigger={handleTrigger}
            isLoading={triggeringOperationId === operation.id}
          />
        ))}
      </div>

      {operations.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-muted-foreground">사용 가능한 작업이 없습니다</p>
        </div>
      )}
    </div>
  );
}
