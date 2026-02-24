'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Member {
  id: string;
  name: string;
  discordUsername: string;
  status: string;
}

interface DeleteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: Member | null;
}

/**
 * Delete Member Confirmation Dialog
 * Soft deletes member (marks as withdrawn)
 * Requirements: 19.5, 19.6
 */
export function DeleteMemberDialog({
  open,
  onClose,
  onSuccess,
  member,
}: DeleteMemberDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!member) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || '삭제에 실패했습니다.');
        return;
      }

      onSuccess();
    } catch (err) {
      setError('서버 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !member) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">멤버 탈퇴 처리</h2>
            <p className="text-sm text-muted-foreground">
              이 작업은 되돌릴 수 없습니다.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm">
            <span className="font-medium">{member.name}</span> ({member.discordUsername})
            님을 탈퇴 처리하시겠습니까?
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            멤버의 데이터(포스트, 출석, 벌금 기록)는 보존되며, 상태만 &apos;탈퇴&apos;로 변경됩니다.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? '처리 중...' : '탈퇴 처리'}
          </Button>
        </div>
      </div>
    </div>
  );
}
