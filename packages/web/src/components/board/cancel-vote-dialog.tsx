'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CancelVoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function CancelVoteDialog({ open, onOpenChange, onConfirm }: CancelVoteDialogProps) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async (e: React.MouseEvent) => {
    e.preventDefault();

    setCancelling(true);
    setError(null);

    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError('투표 취소에 실패했습니다. 다시 시도해주세요.');
      setCancelling(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">투표를 취소하시겠습니까?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            취소한 투표는 다시 복구할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 border border-destructive/20">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={cancelling}
            className="h-9 text-sm"
            onClick={() => setError(null)}
          >
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={cancelling}
            className="h-9 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {cancelling ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                취소 중...
              </span>
            ) : (
              '확인'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
