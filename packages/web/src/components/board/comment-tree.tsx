'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock, Reply, Pencil, Trash2, Loader2, Check, X } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CommentForm } from '@/components/board/comment-form';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface Comment {
  id: string;
  postId: string;
  memberId: string;
  memberName: string;
  memberProfileImage: string | null;
  memberDiscordId: string;
  memberIsAdmin: boolean;
  parentId: string | null;
  content: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
  isMasked: boolean;
}

interface CommentNode extends Comment {
  children: CommentNode[];
}

interface CommentTreeProps {
  comments: Comment[];
  postAuthorId: string;
  currentMemberId: string;
  isAdmin: boolean;
  onRefresh: () => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildCommentTree(comments: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((c) => map.set(c.id, { ...c, children: [] }));
  comments.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// ─────────────────────────────────────────────
// Inline Edit Form
// ─────────────────────────────────────────────

interface InlineEditFormProps {
  comment: Comment;
  onSaved: () => void;
  onCancel: () => void;
}

function InlineEditForm({ comment, onSaved, onCancel }: InlineEditFormProps) {
  const [editContent, setEditContent] = useState(comment.content);
  const [editSecret, setEditSecret] = useState(comment.isSecret);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editContent.trim()) {
      setError('댓글 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/board/${comment.postId}/comments/${comment.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editContent.trim(),
            isSecret: editSecret,
          }),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        setError(result.message || '댓글 수정에 실패했습니다.');
        return;
      }

      onSaved();
    } catch {
      setError('서버 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="space-y-2 mt-2">
      <Textarea
        value={editContent}
        onChange={(e) => {
          setEditContent(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={handleKeyDown}
        rows={2}
        className="resize-none text-sm leading-relaxed focus-visible:ring-sky-500/30 focus-visible:border-sky-400 dark:focus-visible:border-sky-600"
        disabled={saving}
        autoFocus
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`edit-secret-${comment.id}`}
            checked={editSecret}
            onCheckedChange={setEditSecret}
            disabled={saving}
            className="data-[state=checked]:bg-sky-500"
          />
          <Label
            htmlFor={`edit-secret-${comment.id}`}
            className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none"
          >
            <Lock className="h-3 w-3" />
            비밀댓글
          </Label>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={saving}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !editContent.trim()}
            className="h-7 gap-1 text-xs bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Check className="h-3 w-3" />
                저장
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Comment Item
// ─────────────────────────────────────────────

interface CommentItemProps {
  node: CommentNode;
  depth: number;
  postAuthorId: string;
  currentMemberId: string;
  isAdmin: boolean;
  onRefresh: () => void;
}

function CommentItem({
  node,
  depth,
  postAuthorId,
  currentMemberId,
  isAdmin,
  onRefresh,
}: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isOwner = node.memberId === currentMemberId;
  const isPostAuthor = postAuthorId === currentMemberId;
  const canEdit = isOwner && !node.isDeleted && !node.isMasked;
  const canDelete = (isOwner || isAdmin) && !node.isDeleted;
  // 비밀댓글 답글: 본인/글작성자/관리자만 가능 (마스킹된 건 볼 수 없으므로 불가)
  const canReply = !node.isDeleted && !node.isMasked && depth < 3
    && (!node.isSecret || isOwner || isPostAuthor || isAdmin);

  const displayName = node.isDeleted
    ? '알 수 없음'
    : node.isMasked
    ? '익명'
    : node.memberName || '알 수 없음';

  const avatarSeed = node.isDeleted
    ? 'deleted'
    : node.isMasked
    ? 'anonymous'
    : node.memberDiscordId || node.memberName;

  // Visual indent: cap at 3 levels deep
  const indentDepth = Math.min(depth, 3);

  const handleDelete = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/board/${node.postId}/comments/${node.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const result = await res.json();
        console.error(result.message || '댓글 삭제에 실패했습니다.');
        return;
      }
      setDeleteConfirmOpen(false);
      onRefresh();
    } catch {
      console.error('댓글 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Comment row */}
      <div
        className={cn(
          'group',
          depth > 0 && `ml-${indentDepth * 8}`,
          node.isDeleted && 'opacity-60'
        )}
        style={depth > 0 ? { marginLeft: `${indentDepth * 2}rem` } : undefined}
      >
        {/* Depth indicator line */}
        {depth > 0 && (
          <div className="flex gap-3">
            <div className="w-px bg-border/50 shrink-0 mt-1" />
            <div className="flex-1">
              <CommentContent
                node={node}
                displayName={displayName}
                avatarSeed={avatarSeed}
                canEdit={canEdit}
                canDelete={canDelete}
                canReply={canReply}
                deleting={deleting}
                editing={editing}
                replyOpen={replyOpen}
                onEdit={() => setEditing(true)}
                onDelete={() => setDeleteConfirmOpen(true)}
                onReply={() => setReplyOpen((v) => !v)}
              />
            </div>
          </div>
        )}

        {depth === 0 && (
          <CommentContent
            node={node}
            displayName={displayName}
            avatarSeed={avatarSeed}
            canEdit={canEdit}
            canDelete={canDelete}
            canReply={canReply}
            deleting={deleting}
            editing={editing}
            replyOpen={replyOpen}
            onEdit={() => setEditing(true)}
            onDelete={() => setDeleteConfirmOpen(true)}
            onReply={() => setReplyOpen((v) => !v)}
          />
        )}

        {/* Inline edit form */}
        {editing && (
          <div className={cn('mt-1', depth > 0 && 'ml-9')}>
            <InlineEditForm
              comment={node}
              onSaved={() => {
                setEditing(false);
                onRefresh();
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}

        {/* Reply form */}
        {replyOpen && !editing && (
          <div
            className={cn(
              'mt-2 mb-3 rounded-lg border border-border/50 bg-muted/20 p-3',
              depth > 0 ? 'ml-9' : 'ml-9'
            )}
          >
            <p className="text-xs font-medium text-muted-foreground mb-2">
              @{displayName}에게 답글
            </p>
            <CommentForm
              postId={node.postId}
              parentId={node.id}
              parentIsSecret={node.isSecret}
              placeholder={`@${displayName}에게 답글 달기...`}
              onSuccess={() => {
                setReplyOpen(false);
                onRefresh();
              }}
              onCancel={() => setReplyOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <div className="space-y-0">
          {node.children.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              postAuthorId={postAuthorId}
              currentMemberId={currentMemberId}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">댓글을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              삭제된 댓글은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="h-9 text-sm">
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
    </div>
  );
}

// ─────────────────────────────────────────────
// Comment Content (inner layout)
// ─────────────────────────────────────────────

interface CommentContentProps {
  node: CommentNode;
  displayName: string;
  avatarSeed: string;
  canEdit: boolean;
  canDelete: boolean;
  canReply: boolean;
  deleting: boolean;
  editing: boolean;
  replyOpen: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
}

function CommentContent({
  node,
  displayName,
  avatarSeed,
  canEdit,
  canDelete,
  canReply,
  deleting,
  editing,
  replyOpen,
  onEdit,
  onDelete,
  onReply,
}: CommentContentProps) {
  return (
    <div className="flex gap-3 py-3">
      {/* Avatar */}
      <MemberAvatar
        memberId={node.memberId}
        name={displayName}
        seed={avatarSeed}
        imageUrl={node.isDeleted || node.isMasked ? null : node.memberProfileImage}
        size="md"
        noLink={node.isDeleted || node.isMasked}
        className={node.isDeleted ? 'opacity-40' : undefined}
      />

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          {!node.isDeleted && !node.isMasked ? (
            <Link
              href={`/members/${node.memberId}`}
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {displayName}
            </Link>
          ) : (
            <span
              className={cn(
                'text-sm font-medium',
                node.isDeleted && 'text-muted-foreground'
              )}
            >
              {displayName}
            </span>
          )}

          {node.memberIsAdmin && !node.isDeleted && !node.isMasked && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
              관리자
            </span>
          )}

          {node.isSecret && !node.isDeleted && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Lock className="h-2.5 w-2.5" />
              비밀댓글
            </span>
          )}

          <span className="text-xs text-muted-foreground tabular-nums">
            {formatRelativeTime(node.createdAt)}
          </span>

          {node.updatedAt !== node.createdAt && !node.isDeleted && (
            <span className="text-[11px] text-muted-foreground/60">(수정됨)</span>
          )}
        </div>

        {/* Content */}
        {!editing && (
          <p
            className={cn(
              'text-sm leading-relaxed break-words whitespace-pre-wrap',
              node.isDeleted && 'italic text-muted-foreground text-xs',
              node.isMasked &&
                'italic text-muted-foreground text-xs bg-muted/40 rounded px-2 py-1'
            )}
          >
            {node.content}
          </p>
        )}

        {/* Action buttons */}
        {!editing && (
          <div className="flex items-center gap-1 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {canReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReply}
                className={cn(
                  'h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground',
                  replyOpen && 'text-sky-500 hover:text-sky-600'
                )}
              >
                <Reply className="h-3 w-3" />
                답글
              </Button>
            )}

            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                수정
              </Button>
            )}

            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={deleting}
                className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-destructive"
              >
                {deleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                삭제
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CommentTree (public export)
// ─────────────────────────────────────────────

export function CommentTree({
  comments,
  postAuthorId,
  currentMemberId,
  isAdmin,
  onRefresh,
}: CommentTreeProps) {
  const tree = buildCommentTree(comments);

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-1.5 text-center">
        <p className="text-sm text-muted-foreground">아직 댓글이 없습니다.</p>
        <p className="text-xs text-muted-foreground/60">첫 댓글을 남겨보세요.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {tree.map((node) => (
        <CommentItem
          key={node.id}
          node={node}
          depth={0}
          postAuthorId={postAuthorId}
          currentMemberId={currentMemberId}
          isAdmin={isAdmin}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
