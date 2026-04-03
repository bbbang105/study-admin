'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BotOperation } from '@/components/bot-operation-card';
import { BotOperationRow, categoryConfig } from '@/components/bot-operation-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import NotificationLogs from './notification-logs';

// 카테고리 표시 순서
const CATEGORY_ORDER = ['polling', 'attendance', 'fine', 'round', 'ranking', 'poll', 'curation'];

export default function BotOperationsPage() {
  const [operations, setOperations] = useState<BotOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    }
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

      setOperations((prev) =>
        prev.map((op) => (op.id === operationId ? { ...op, running: true } : op))
      );

      setTimeout(() => fetchOperations(), 2000);
    } catch (error) {
      console.error('Failed to trigger operation:', error);
      throw error;
    } finally {
      setTriggeringOperationId(null);
    }
  };

  // 카테고리별 그룹핑
  const grouped = useMemo(() => {
    const map = new Map<string, BotOperation[]>();
    for (const op of operations) {
      const list = map.get(op.category) || [];
      list.push(op);
      map.set(op.category, list);
    }
    // 정의된 순서대로 정렬, 나머지는 뒤에
    const sorted: [string, BotOperation[]][] = [];
    for (const cat of CATEGORY_ORDER) {
      const ops = map.get(cat);
      if (ops) sorted.push([cat, ops]);
    }
    for (const [cat, ops] of map) {
      if (!CATEGORY_ORDER.includes(cat)) sorted.push([cat, ops]);
    }
    return sorted;
  }, [operations]);

  useEffect(() => {
    fetchOperations();
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">봇 관리</h1>
        <p className="text-muted-foreground mt-1 text-sm">봇 작업 실행 및 알림 로그 확인</p>
      </div>

      <Tabs defaultValue="operations">
        <TabsList>
          <TabsTrigger value="operations">수동 실행</TabsTrigger>
          <TabsTrigger value="logs">알림 로그</TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {grouped.map(([category, ops]) => {
              const config = categoryConfig[category] || { label: category, color: '' };
              return (
                <Card key={category}>
                  <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={config.color}>
                        {config.label}
                      </Badge>
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {ops.length}개
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-1.5">
                    {ops.map((op) => (
                      <BotOperationRow
                        key={op.id}
                        operation={op}
                        onTrigger={handleTrigger}
                        isLoading={triggeringOperationId === op.id}
                      />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {operations.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
              <p className="text-muted-foreground">사용 가능한 작업이 없습니다</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <NotificationLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
