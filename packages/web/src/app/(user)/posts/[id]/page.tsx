'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Reply,
  Trash2,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { PageError } from '@/components/ui/page-state';
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
import { cn, getDefaultAvatar } from '@/lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CommentMember {
  name: string;
  nickname: string | null;
  discordUsername: string;
  profileImageUrl: string | null;
  discordId: string;
  isAdmin: boolean;
}

interface Comment {
  id: string;
  postId: string;
  memberId: string;
  parentId: string | null;
  content: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  isMasked: boolean;
  isOwner: boolean;
  member: CommentMember;
}

interface CommentNode extends Comment {
  children: CommentNode[];
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
// CommentBody
// ─────────────────────────────────────────────

function CommentBody({
  node,
  displayName,
  isEdited,
  editing,
  editContent,
  editSecret,
  saving,
  replyOpen,
  canReply,
  canEdit,
  canDelete,
  onEditContentChange,
  onEditSecretChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onReply,
}: {
  node: CommentNode;
  displayName: string;
  isEdited: boolean;
  editing: boolean;
  editContent: string;
  editSecret: boolean;
  saving: boolean;
  replyOpen: boolean;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEditContentChange: (v: string) => void;
  onEditSecretChange: (v: boolean) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
}) {
  return (
    <div className={cn('flex gap-3 py-3', node.isDeleted && 'opacity-60')}>
      <MemberAvatar
        memberId={node.memberId}
        name={displayName}
        seed={
          node.isDeleted
            ? 'deleted'
            : node.isMasked
              ? 'secret'
              : node.member.discordId || displayName
        }
        imageUrl={node.isDeleted || node.isMasked ? null : node.member.profileImageUrl}
        size="md"
        noLink={node.isDeleted || node.isMasked}
        className={node.isDeleted ? 'opacity-40' : undefined}
      />

      <div className="flex-1 min-w-0 space-y-1">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          {node.isDeleted || node.isMasked ? (
            <span className="text-sm font-medium text-muted-foreground">{displayName}</span>
          ) : (
            <Link
              href={`/members/${node.memberId}`}
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {displayName}
            </Link>
          )}

          {node.member.isAdmin && !node.isDeleted && !node.isMasked && (
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

          {isEdited && !node.isDeleted && (
            <span className="text-[11px] text-muted-foreground/60">(수정됨)</span>
          )}
        </div>

        {/* Content */}
        {!editing && (
          <p
            className={cn(
              'text-sm leading-relaxed break-words whitespace-pre-wrap',
              node.isDeleted && 'italic text-muted-foreground text-xs',
              node.isMasked && 'italic text-muted-foreground text-xs bg-muted/40 rounded px-2 py-1'
            )}
          >
            {node.content}
          </p>
        )}

        {/* Inline edit */}
        {editing && (
          <div className="space-y-2 mt-1">
            <Textarea
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSaveEdit();
                if (e.key === 'Escape') onCancelEdit();
              }}
              rows={2}
              className="resize-none text-sm leading-relaxed"
              disabled={saving}
              aria-label="댓글 수정"
            />
            <div className="flex items-center gap-2">
              <Switch
                id={`edit-secret-${node.id}`}
                checked={editSecret}
                onCheckedChange={onEditSecretChange}
                disabled={saving}
                className="data-[state=checked]:bg-sky-500"
              />
              <Label
                htmlFor={`edit-secret-${node.id}`}
                className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none"
              >
                <Lock className="h-3 w-3" />
                비밀댓글
              </Label>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelEdit}
                disabled={saving}
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                취소
              </Button>
              <Button
                size="sm"
                onClick={onSaveEdit}
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
        )}

        {/* Action buttons */}
        {!editing && (
          <div className="flex items-center gap-1 pt-0.5">
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
                onClick={onStartEdit}
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
                className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
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
// PostCommentItem
// ─────────────────────────────────────────────

function PostCommentItem({
  node,
  depth,
  postId,
  onRefresh,
  onCommentCountChange,
}: {
  node: CommentNode;
  depth: number;
  postId: string;
  onRefresh: () => void;
  onCommentCountChange: (delta: number) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(node.content);
  const [editSecret, setEditSecret] = useState(node.isSecret);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyIsSecret, setReplyIsSecret] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);

  const displayName = node.isDeleted
    ? '알 수 없음'
    : node.isMasked
      ? '익명'
      : node.member.nickname || node.member.name || node.member.discordUsername;
  const isEdited = new Date(node.updatedAt).getTime() - new Date(node.createdAt).getTime() > 1000;

  const canEdit = node.isOwner && !node.isDeleted && !node.isMasked;
  const canDelete = node.isOwner && !node.isDeleted;
  const canReply = !node.isDeleted && !node.isMasked && depth < 5;

  // 비밀댓글 답글: 자동 비밀 처리
  const forceReplySecret = node.isSecret;

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${node.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim(), isSecret: editSecret }),
      });
      if (!res.ok) {
        toast.error('수정에 실패했습니다.');
        return;
      }
      setEditing(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${node.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('삭제에 실패했습니다.');
        return;
      }
      setDeleteConfirmOpen(false);
      onCommentCountChange(-1);
      onRefresh();
    } finally {
      setDeleting(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!replyContent.trim()) return;
    setReplySubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent.trim(),
          parentId: node.id,
          isSecret: forceReplySecret || replyIsSecret,
        }),
      });
      if (!res.ok) {
        const result = await res.json();
        toast.error(result.message || '답글 작성에 실패했습니다.');
        return;
      }
      setReplyContent('');
      setReplyIsSecret(false);
      setReplyOpen(false);
      onCommentCountChange(1);
      onRefresh();
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const bodyProps = {
    node,
    displayName,
    isEdited,
    editing,
    editContent,
    editSecret,
    saving,
    replyOpen,
    canReply,
    canEdit,
    canDelete,
    onEditContentChange: setEditContent,
    onEditSecretChange: setEditSecret,
    onSaveEdit: handleSaveEdit,
    onCancelEdit: () => {
      setEditing(false);
      setEditContent(node.content);
      setEditSecret(node.isSecret);
    },
    onStartEdit: () => setEditing(true),
    onDelete: () => setDeleteConfirmOpen(true),
    onReply: () => setReplyOpen((v) => !v),
  };

  return (
    <div>
      <div style={depth > 0 ? { marginLeft: `${Math.min(depth, 5) * 1.5}rem` } : undefined}>
        {depth > 0 ? (
          <div className="flex gap-3">
            <div className="w-px bg-border/50 shrink-0 mt-1" />
            <div className="flex-1">
              <CommentBody {...bodyProps} />
            </div>
          </div>
        ) : (
          <CommentBody {...bodyProps} />
        )}

        {/* Reply form */}
        {replyOpen && !editing && (
          <div
            className={cn('mt-2 mb-3 rounded-lg border border-border/50 bg-muted/20 p-3', 'ml-9')}
          >
            <p className="text-xs font-medium text-muted-foreground mb-2">
              @{displayName}에게 답글
            </p>
            <div className="space-y-2">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleReplySubmit();
                  if (e.key === 'Escape') {
                    setReplyOpen(false);
                    setReplyContent('');
                  }
                }}
                placeholder={`@${displayName}에게 답글 달기…`}
                rows={2}
                className="resize-none text-sm leading-relaxed"
                disabled={replySubmitting}
                aria-label={`${displayName}에게 답글`}
              />
              <div className="flex items-center gap-2">
                <Switch
                  id={`reply-secret-${node.id}`}
                  checked={forceReplySecret || replyIsSecret}
                  onCheckedChange={forceReplySecret ? undefined : setReplyIsSecret}
                  disabled={replySubmitting || forceReplySecret}
                  className="data-[state=checked]:bg-sky-500"
                />
                <Label
                  htmlFor={`reply-secret-${node.id}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap"
                >
                  <Lock className="h-3 w-3" />
                  비밀댓글{forceReplySecret && ' (자동)'}
                </Label>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyOpen(false);
                    setReplyContent('');
                    setReplyIsSecret(false);
                  }}
                  disabled={replySubmitting}
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  취소
                </Button>
                <Button
                  size="sm"
                  onClick={handleReplySubmit}
                  disabled={replySubmitting || !replyContent.trim()}
                  className="h-7 gap-1 text-xs bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
                >
                  {replySubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    '답글 등록'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <PostCommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              postId={postId}
              onRefresh={onRefresh}
              onCommentCountChange={onCommentCountChange}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
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
// PostDetailPage
// ─────────────────────────────────────────────

export default function PostDetailPage() {
  const { id: postId } = useParams<{ id: string }>();

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [newCommentSecret, setNewCommentSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [postInfo, setPostInfo] = useState<{
    title: string;
    url: string;
    authorName: string;
    authorAvatar: string;
    authorId: string | null;
    publishedAt: string;
    thumbnailUrl: string | null;
    description: string | null;
  } | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (!res.ok) throw new Error('Failed to load comments');
      const result = await res.json();
      setComments(result.data);
      setCommentCount(result.data.length);
    } catch (err) {
      setError('댓글을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    async function fetchPostInfo() {
      try {
        const res = await fetch(`/api/posts?page=1&pageSize=100`);
        if (res.ok) {
          const result = await res.json();
          const post = result.data.posts.find((p: { id: string }) => p.id === postId);
          if (post) {
            const name = post.memberNickname || post.memberDiscordUsername;
            setPostInfo({
              title: post.title,
              url: post.url,
              authorName: name,
              authorAvatar: post.memberProfileImageUrl || getDefaultAvatar(name),
              authorId: post.memberId,
              publishedAt: post.publishedAt,
              thumbnailUrl: post.thumbnailUrl || null,
              description: post.description || null,
            });
          }
        }
      } catch {
        // Non-critical
      }
    }
    fetchPostInfo();
    fetchComments();
  }, [postId, fetchComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim(), isSecret: newCommentSecret }),
      });
      if (!res.ok) {
        const result = await res.json();
        toast.error(result.message || '댓글 작성에 실패했습니다.');
        return;
      }
      setNewComment('');
      setNewCommentSecret(false);
      setCommentCount((c) => c + 1);
      fetchComments();
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (error && comments.length === 0) {
    return <PageError message={error} />;
  }

  const commentTree = buildCommentTree(comments);

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link
        href="/posts"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        포스트 목록
      </Link>

      {/* Post info card */}
      {postInfo && (
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              {postInfo.authorId ? (
                <Link href={`/members/${postInfo.authorId}`} className="shrink-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={postInfo.authorAvatar} alt={postInfo.authorName} />
                    <AvatarFallback className="text-xs">{postInfo.authorName[0]}</AvatarFallback>
                  </Avatar>
                </Link>
              ) : (
                <Avatar className="h-9 w-9">
                  <AvatarImage src={postInfo.authorAvatar} alt={postInfo.authorName} />
                  <AvatarFallback className="text-xs">{postInfo.authorName[0]}</AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{postInfo.authorName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(postInfo.publishedAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
            <a
              href={postInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 group/link"
            >
              <h1 className="text-base font-semibold text-foreground leading-snug group-hover/link:text-primary transition-colors">
                {postInfo.title}
              </h1>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover/link:text-primary transition-colors mt-0.5" />
            </a>
            {postInfo.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {postInfo.description}
              </p>
            )}
            {postInfo.thumbnailUrl && (
              <div className="rounded-md overflow-hidden border border-border/40">
                <img
                  src={postInfo.thumbnailUrl}
                  alt={postInfo.title}
                  className="w-full max-h-64 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comments section */}
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">댓글</span>
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-sky-100 px-1.5 text-[11px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
              {commentCount}
            </span>
          </div>

          {/* Comments list */}
          <div className="border-t border-border/40">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : commentTree.length > 0 ? (
              <div className="divide-y divide-border/40">
                {commentTree.map((node) => (
                  <PostCommentItem
                    key={node.id}
                    node={node}
                    depth={0}
                    postId={postId}
                    onRefresh={fetchComments}
                    onCommentCountChange={(delta) => setCommentCount((c) => c + delta)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-1.5 text-center">
                <p className="text-sm text-muted-foreground">아직 댓글이 없습니다.</p>
                <p className="text-xs text-muted-foreground/60">첫 댓글을 남겨보세요.</p>
              </div>
            )}
          </div>

          {/* Comment input */}
          <div className="border-t border-border/40 pt-3 space-y-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmitComment();
              }}
              placeholder="댓글을 입력해주세요…"
              aria-label="댓글 입력"
              rows={2}
              className="resize-none text-sm leading-relaxed"
            />
            <div className="flex items-center gap-x-3 gap-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="new-comment-secret"
                  checked={newCommentSecret}
                  onCheckedChange={setNewCommentSecret}
                  disabled={submitting}
                  className="data-[state=checked]:bg-sky-500"
                />
                <Label
                  htmlFor="new-comment-secret"
                  className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap"
                >
                  <Lock className="h-3 w-3" />
                  비밀댓글
                </Label>
              </div>
              <div className="ml-auto">
                <Button
                  size="sm"
                  onClick={handleSubmitComment}
                  disabled={submitting || !newComment.trim()}
                  className="h-7 gap-1 text-xs bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    '댓글 등록'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
