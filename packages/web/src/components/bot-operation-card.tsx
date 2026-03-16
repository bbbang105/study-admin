'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, Loader2, Play } from 'lucide-react';

export interface BotOperation {
  id: string;
  name: string;
  description: string;
  category: string;
  schedule: string;
  running: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

interface BotOperationCardProps {
  operation: BotOperation;
  onTrigger: (operationId: string) => Promise<void>;
  isLoading?: boolean;
}

const categoryColors: Record<string, string> = {
  polling: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  attendance: 'bg-green-500/10 text-green-500 border-green-500/20',
  fine: 'bg-red-500/10 text-red-500 border-red-500/20',
  round: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  curation: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  ranking: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
};

const categoryLabels: Record<string, string> = {
  polling: '폴링',
  attendance: '출석',
  fine: '벌금',
  round: '회차',
  curation: '큐레이션',
  ranking: '랭킹',
};

export function BotOperationCard({
  operation,
  onTrigger,
  isLoading = false,
}: BotOperationCardProps) {
  const handleTrigger = async () => {
    if (isLoading || operation.running) return;

    try {
      await onTrigger(operation.id);
      toast.success(`${operation.name} 작업이 시작되었습니다`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '작업 실행에 실패했습니다');
    }
  };

  const statusIndicator = operation.running ? (
    <div className="flex items-center gap-1.5 text-sm text-blue-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>실행 중</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>대기 중</span>
    </div>
  );

  return (
    <Card
      className={`group transition-shadow ${operation.disabled ? 'opacity-50' : 'hover:shadow-md'}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-lg">
              {operation.name}
              {operation.disabled && (
                <Badge variant="secondary" className="ml-2 text-[10px] font-normal">
                  {operation.disabledReason || '미사용'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="line-clamp-2">{operation.description}</CardDescription>
          </div>
          <Badge
            variant="outline"
            className={categoryColors[operation.category] || categoryColors.polling}
          >
            {categoryLabels[operation.category] || operation.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">실행 주기</span>
          <span className="font-medium">{operation.schedule}</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          {operation.disabled ? (
            <span className="text-xs text-muted-foreground">비활성화됨</span>
          ) : (
            statusIndicator
          )}
          <Button
            size="sm"
            onClick={handleTrigger}
            disabled={isLoading || operation.running || operation.disabled}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                실행 중
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                직접 실행
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
