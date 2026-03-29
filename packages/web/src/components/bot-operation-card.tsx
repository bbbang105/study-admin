'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Play } from 'lucide-react';

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

interface BotOperationRowProps {
  operation: BotOperation;
  onTrigger: (operationId: string) => Promise<void>;
  isLoading?: boolean;
}

export const categoryConfig: Record<string, { label: string; color: string }> = {
  polling: { label: '폴링', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  attendance: { label: '출석', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  fine: { label: '벌금', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  round: { label: '회차', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  curation: { label: '큐레이션', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  ranking: { label: '랭킹', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  poll: { label: '투표', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
};

export function BotOperationRow({ operation, onTrigger, isLoading = false }: BotOperationRowProps) {
  const handleTrigger = async () => {
    if (isLoading || operation.running || operation.disabled) return;

    try {
      await onTrigger(operation.id);
      toast.success(`${operation.name} 작업이 시작되었습니다`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '작업 실행에 실패했습니다');
    }
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        operation.disabled
          ? 'border-dashed border-border/50 opacity-50'
          : 'bg-card hover:bg-muted/50'
      }`}
    >
      {/* Name + Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{operation.name}</span>
          {operation.disabled && (
            <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
              {operation.disabledReason || '미사용'}
            </Badge>
          )}
          {operation.running && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{operation.schedule}</p>
      </div>

      {/* Run Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleTrigger}
        disabled={isLoading || operation.running || operation.disabled}
        className="h-8 px-3 shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
