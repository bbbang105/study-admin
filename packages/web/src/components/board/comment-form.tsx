'use client';

import { useState } from 'react';
import { Lock, Loader2, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CommentFormProps {
  postId: string;
  parentId?: string | null;
  /** 부모 댓글이 비밀댓글이면 답글도 강제 비밀 */
  parentIsSecret?: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

// ─────────────────────────────────────────────
// CommentForm
// ─────────────────────────────────────────────

export function CommentForm({
  postId,
  parentId,
  parentIsSecret = false,
  onSuccess,
  onCancel,
  placeholder = '댓글을 입력해주세요...',
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [isSecret, setIsSecret] = useState(parentIsSecret);
  const forceSecret = parentIsSecret;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('댓글 내용을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/board/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          parentId: parentId ?? null,
          isSecret: forceSecret || isSecret,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.message || '댓글 작성에 실패했습니다.');
        return;
      }

      setContent('');
      setIsSecret(false);
      onSuccess();
    } catch {
      setError('서버 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isReply = !!parentId;

  return (
    <div className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={isReply ? 2 : 3}
        className="resize-none text-sm leading-relaxed focus-visible:ring-sky-500/30 focus-visible:border-sky-400 dark:focus-visible:border-sky-600"
        disabled={submitting}
      />

      {error && (
        <p role="alert" aria-live="assertive" className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        {/* Secret toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id={`secret-${parentId ?? 'root'}`}
            checked={forceSecret || isSecret}
            onCheckedChange={forceSecret ? undefined : setIsSecret}
            disabled={submitting || forceSecret}
            className="data-[state=checked]:bg-sky-500"
          />
          <Label
            htmlFor={`secret-${parentId ?? 'root'}`}
            className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none"
          >
            <Lock className="h-3 w-3" />
            비밀댓글{forceSecret && ' (자동)'}
          </Label>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={submitting}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              취소
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="h-8 gap-1.5 text-xs bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                등록 중...
              </>
            ) : (
              isReply ? '답글 등록' : '댓글 등록'
            )}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/60">
        Ctrl+Enter 또는 Cmd+Enter로 빠르게 등록할 수 있습니다.
      </p>
    </div>
  );
}
