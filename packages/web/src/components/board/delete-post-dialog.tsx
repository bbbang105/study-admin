'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DeletePostDialogProps {
  postId: string;
  onDeleted?: () => void;
}

// ─────────────────────────────────────────────
// DeletePostDialog
// ─────────────────────────────────────────────

export function DeletePostDialog({ postId, onDeleted }: DeletePostDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent) => {
    // Prevent AlertDialog from closing immediately — we handle it ourselves
    e.preventDefault();

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/board/${postId}`, {
        method: 'DELETE',
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.message || '게시글 삭제에 실패했습니다.');
        setDeleting(false);
        return;
      }

      setOpen(false);

      if (onDeleted) {
        onDeleted();
      } else {
        router.push('/board');
      }
    } catch {
      setError('서버 오류가 발생했습니다. 다시 시도해주세요.');
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          삭제
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">게시글을 삭제하시겠습니까?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            삭제된 게시글은 복구할 수 없습니다. 댓글도 함께 삭제됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 border border-destructive/20">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={deleting}
            className="h-9 text-sm"
            onClick={() => setError(null)}
          >
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="h-9 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {deleting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                삭제 중...
              </span>
            ) : (
              '삭제하기'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
