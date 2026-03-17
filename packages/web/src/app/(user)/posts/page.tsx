'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  Check,
  Clock,
  Eye,
  FileText,
  Flame,
  Globe,
  Loader2,
  Lock,
  Medal,
  MessageCircle,
  Pencil,
  Plus,
  Reply,
  Search,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { PartBadge } from '@/components/ui/part-badge';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { PageError, PostsListSkeleton } from '@/components/ui/page-state';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn, getDefaultAvatar } from '@/lib/utils';
import { getPartStyle, PART_OPTIONS } from '@/lib/part-config';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Viewer {
  memberId: string;
  nickname: string | null;
  discordUsername: string;
  profileImageUrl: string | null;
}

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

interface Post {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  description: string | null;
  thumbnailUrl: string | null;
  commentCount: number;
  memberId: string | null;
  memberNickname: string | null;
  memberDiscordUsername: string;
  memberProfileImageUrl: string | null;
  memberPart: string | null;
  roundId: number | null;
  roundNumber: number | null;
  viewCount: number;
  viewers: Viewer[];
  totalViewers: number;
}

interface PostsData {
  posts: Post[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
}

type TabType = 'latest' | 'popular';

const MEDAL_STYLES = [
  // 1위: 금
  'ring-2 ring-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.3)]',
  // 2위: 은
  'ring-2 ring-slate-300/80 shadow-[0_0_10px_rgba(148,163,184,0.3)]',
  // 3위: 동
  'ring-2 ring-orange-400/70 shadow-[0_0_10px_rgba(251,146,60,0.25)]',
] as const;

const MEDAL_BADGE_STYLES = [
  'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
  'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-700',
  'bg-gradient-to-r from-orange-400 to-amber-500 text-white',
] as const;

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

/** 도메인 기반 결정적 그라디언트 생성 */
function getDomainGradient(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
      hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 60%, 70%), hsl(${h2}, 50%, 55%))`;
  } catch {
    return 'linear-gradient(135deg, hsl(210, 60%, 70%), hsl(250, 50%, 55%))';
  }
}

/** 도메인 라벨 추출 (velog, tistory 등) */
function getDomainLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('velog')) return 'velog';
    if (hostname.includes('tistory')) return 'tistory';
    if (hostname.includes('medium')) return 'medium';
    if (hostname.includes('github.io')) return 'github';
    if (hostname.includes('notion')) return 'notion';
    if (hostname.includes('naver')) return 'naver';
    return hostname.replace(/^www\./, '').split('.')[0] || 'blog';
  } catch {
    return 'blog';
  }
}

/** HTML 태그 제거 + 엔티티 디코딩 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 설명 텍스트 정리 (HTML strip + 200자 제한) */
function formatDescription(desc: string): string {
  const cleaned = stripHtml(desc);
  return cleaned.length > 200 ? cleaned.slice(0, 200) + '\u2026' : cleaned;
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
// PostCommentItem (게시판 스타일)
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
      setReplyOpen(false);
      onCommentCountChange(1);
      onRefresh();
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <div>
      <div style={depth > 0 ? { marginLeft: `${Math.min(depth, 5) * 1.5}rem` } : undefined}>
        {depth > 0 ? (
          <div className="flex gap-3">
            <div className="w-px bg-border/50 shrink-0 mt-1" />
            <div className="flex-1">
              <CommentBody
                node={node}
                displayName={displayName}
                isEdited={isEdited}
                editing={editing}
                editContent={editContent}
                editSecret={editSecret}
                saving={saving}
                replyOpen={replyOpen}
                canReply={!node.isDeleted && !node.isMasked && depth < 5}
                canEdit={canEdit}
                canDelete={canDelete}
                onEditContentChange={setEditContent}
                onEditSecretChange={setEditSecret}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => {
                  setEditing(false);
                  setEditContent(node.content);
                  setEditSecret(node.isSecret);
                }}
                onStartEdit={() => setEditing(true)}
                onDelete={() => setDeleteConfirmOpen(true)}
                onReply={() => setReplyOpen((v) => !v)}
              />
            </div>
          </div>
        ) : (
          <CommentBody
            node={node}
            displayName={displayName}
            isEdited={isEdited}
            editing={editing}
            editContent={editContent}
            editSecret={editSecret}
            saving={saving}
            replyOpen={replyOpen}
            canReply={!node.isDeleted && !node.isMasked && depth < 5}
            canEdit={canEdit}
            canDelete={canDelete}
            onEditContentChange={setEditContent}
            onEditSecretChange={setEditSecret}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={() => {
              setEditing(false);
              setEditContent(node.content);
              setEditSecret(node.isSecret);
            }}
            onStartEdit={() => setEditing(true)}
            onDelete={() => setDeleteConfirmOpen(true)}
            onReply={() => setReplyOpen((v) => !v)}
          />
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
                placeholder={`@${displayName}에게 답글 달기\u2026`}
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
// CommentBody (inner layout - 게시판 스타일)
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
      {/* Avatar */}
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

      {/* Body */}
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

        {/* Action buttons - 항상 표시 */}
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
// PostCard with inline comments
// ─────────────────────────────────────────────

/** 썸네일 컴포넌트 (이미지 or 그라디언트 폴백) */
function PostThumbnail({
  url,
  thumbnailUrl,
  className,
}: {
  url: string;
  thumbnailUrl: string | null;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (thumbnailUrl && !imgError) {
    return (
      <div className={cn('relative overflow-hidden rounded-md bg-muted', className)}>
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 160px"
          onError={() => setImgError(true)}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md flex items-center justify-center',
        className
      )}
      style={{ background: getDomainGradient(url) }}
    >
      <div className="flex flex-col items-center gap-1 text-white/80">
        <Globe className="h-5 w-5" />
        <span className="text-[10px] font-medium uppercase tracking-wider">
          {getDomainLabel(url)}
        </span>
      </div>
    </div>
  );
}

function PostCard({
  post,
  onView,
  onCommentCountChange,
  rank,
}: {
  post: Post;
  onView: (id: string) => void;
  onCommentCountChange: (postId: string, delta: number) => void;
  rank?: number; // 1, 2, 3 for medal styling
}) {
  const authorName = post.memberNickname || post.memberDiscordUsername;
  const authorAvatar = post.memberProfileImageUrl || getDefaultAvatar(authorName);
  const extraViewers = post.totalViewers - post.viewers.length;

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newCommentSecret, setNewCommentSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      if (!res.ok) return;
      const result = await res.json();
      setComments(result.data);
      setCommentsLoaded(true);
    } catch {
      // silent
    }
  }, [post.id]);

  useEffect(() => {
    if (showComments && !commentsLoaded) {
      fetchComments();
    }
  }, [showComments, commentsLoaded, fetchComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
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
      onCommentCountChange(post.id, 1);
      fetchComments();
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const commentTree = buildCommentTree(comments);

  return (
    <Card
      className={cn(
        'border-border shadow-sm hover:border-border/80 transition-all duration-200 overflow-hidden',
        rank && rank <= 3 && MEDAL_STYLES[rank - 1]
      )}
    >
      <CardContent className="p-0 relative">
        {/* 메달 뱃지 */}
        {rank && rank <= 3 && (
          <div
            className={cn(
              'absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-md',
              MEDAL_BADGE_STYLES[rank - 1]
            )}
          >
            <Medal className="h-3 w-3" />
            {rank}위
          </div>
        )}

        {/* 모바일: 세로형 (썸네일 위, 텍스트 아래) / 데스크톱: 가로형 */}
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block group/link"
          onClick={() => onView(post.id)}
        >
          {/* 모바일: 풀와이드 썸네일 */}
          <PostThumbnail
            url={post.url}
            thumbnailUrl={post.thumbnailUrl}
            className="sm:hidden aspect-video w-full"
          />

          {/* sm+: 가로 레이아웃 */}
          <div className="flex gap-3 p-4">
            {/* 데스크톱 썸네일 */}
            <PostThumbnail
              url={post.url}
              thumbnailUrl={post.thumbnailUrl}
              className="hidden sm:flex shrink-0 w-[140px] h-[90px]"
            />

            {/* 텍스트 영역 */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover/link:text-primary transition-colors">
                {post.title}
              </h3>
              {post.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 hidden sm:block">
                  {formatDescription(post.description)}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-auto">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={authorAvatar} alt={authorName} />
                  <AvatarFallback className="text-[8px]">{authorName[0]}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate">{authorName}</span>
                {post.memberPart && <PartBadge part={post.memberPart} size="sm" />}
                <span className="text-xs text-muted-foreground/50">·</span>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(post.publishedAt)}
                </time>
              </div>
            </div>
          </div>
        </a>

        {/* 모바일: 설명 + 상호작용 영역 */}
        {post.description &&
          (() => {
            const plain = stripHtml(post.description);
            return (
              <p className="text-xs text-muted-foreground leading-relaxed px-4 pb-2 sm:hidden">
                {plain.length > 100 ? plain.slice(0, 100) + '\u2026' : plain}
              </p>
            );
          })()}

        {/* Footer: viewers + comments toggle */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-1">
          <div className="flex items-center gap-1.5">
            {post.viewers.length > 0 ? (
              <div className="flex -space-x-1.5">
                {post.viewers.map((viewer) => {
                  const vName = viewer.nickname || viewer.discordUsername;
                  const vAvatar = viewer.profileImageUrl || getDefaultAvatar(vName);
                  return (
                    <Avatar key={viewer.memberId} className="h-5 w-5 ring-2 ring-background">
                      <AvatarImage src={vAvatar} alt={vName} />
                      <AvatarFallback className="text-[8px]">{vName[0]}</AvatarFallback>
                    </Avatar>
                  );
                })}
                {extraViewers > 0 && (
                  <div className="h-5 w-5 rounded-full bg-muted ring-2 ring-background flex items-center justify-center">
                    <span className="text-[8px] font-medium text-muted-foreground">
                      +{extraViewers}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <Eye className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
            <span className="text-xs text-muted-foreground tabular-nums">{post.viewCount}</span>
          </div>

          <button
            onClick={() => setShowComments(!showComments)}
            aria-label={`댓글 ${post.commentCount}개 ${showComments ? '닫기' : '보기'}`}
            className={`flex items-center gap-1 text-xs transition-colors ${
              showComments
                ? 'text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="tabular-nums">{post.commentCount}</span>
          </button>
        </div>

        {/* Comments section (게시판 스타일) */}
        {showComments && (
          <div className="border-t border-border/40 px-4 pt-1">
            <div className="flex items-center gap-2 py-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">댓글</span>
              <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-sky-100 px-1.5 text-[11px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                {post.commentCount}
              </span>
            </div>

            <div className="border-t border-border/40">
              {commentsLoaded && commentTree.length > 0 && (
                <div className="divide-y divide-border/40">
                  {commentTree.map((node) => (
                    <PostCommentItem
                      key={node.id}
                      node={node}
                      depth={0}
                      postId={post.id}
                      onRefresh={fetchComments}
                      onCommentCountChange={(delta) => onCommentCountChange(post.id, delta)}
                    />
                  ))}
                </div>
              )}

              {commentsLoaded && commentTree.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-1.5 text-center">
                  <p className="text-sm text-muted-foreground">아직 댓글이 없습니다.</p>
                  <p className="text-xs text-muted-foreground/60">첫 댓글을 남겨보세요.</p>
                </div>
              )}

              {!commentsLoaded && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="border-t border-border/40 pt-3 pb-3 space-y-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmitComment();
                }}
                placeholder="댓글을 입력해주세요\u2026"
                aria-label="댓글 입력"
                rows={2}
                className="resize-none text-sm leading-relaxed"
              />
              <div className="flex items-center gap-x-3 gap-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`comment-secret-${post.id}`}
                    checked={newCommentSecret}
                    onCheckedChange={setNewCommentSecret}
                    disabled={submitting}
                    className="data-[state=checked]:bg-sky-500"
                  />
                  <Label
                    htmlFor={`comment-secret-${post.id}`}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// PostsContent
// ─────────────────────────────────────────────

function PostsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'latest';

  const [tab, setTab] = useState<TabType>(initialTab);
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Refs for IntersectionObserver (avoid stale closures)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const pageRef = useRef(page);
  hasMoreRef.current = hasMore;
  loadingMoreRef.current = loadingMore;
  pageRef.current = page;

  // Manual post dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [postUrl, setPostUrl] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [needsTitle, setNeedsTitle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const PAGE_SIZE = 12;

  const fetchPosts = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          pageSize: String(PAGE_SIZE),
        });
        if (tab === 'popular') params.set('sort', 'popular');
        if (searchQuery) params.set('search', searchQuery);
        if (selectedParts.length > 0) params.set('parts', selectedParts.join(','));

        const response = await fetch(`/api/posts?${params}`);
        if (!response.ok) throw new Error('Failed to fetch posts');
        const result = await response.json();
        const data = result.data as PostsData;

        if (append) {
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newPosts = data.posts.filter((p: { id: string }) => !existingIds.has(p.id));
            return [...prev, ...newPosts];
          });
        } else {
          setPosts(data.posts);
        }
        setTotalCount(data.pagination.totalCount);
        setHasMore(pageNum < data.pagination.totalPages);
        setPage(pageNum);
      } catch (err) {
        setError('포스트 목록을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, searchQuery, selectedParts]
  );

  // Initial load + tab change
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(false);
    fetchPosts(1, false);
  }, [fetchPosts]);

  // IntersectionObserver for infinite scroll — re-attach after loading finishes
  useEffect(() => {
    if (loading) return; // sentinel not in DOM yet
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasMoreRef.current &&
          !loadingMoreRef.current &&
          pageRef.current >= 1
        ) {
          fetchPosts(pageRef.current + 1, true);
        }
      },
      { rootMargin: '200px', threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, fetchPosts]);

  const handleTabChange = (newTab: TabType) => {
    setTab(newTab);
    router.push(`/posts?tab=${newTab}`);
  };

  const trackPostView = (postId: string) => {
    fetch(`/api/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
  };

  const handleCommentCountChange = (postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount + delta) } : p
      )
    );
  };

  const resetDialog = () => {
    setPostUrl('');
    setPostTitle('');
    setNeedsTitle(false);
    setSubmitError(null);
  };

  const handleManualSubmit = async () => {
    if (!postUrl.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const body: Record<string, string> = { url: postUrl.trim() };
      if (needsTitle && postTitle.trim()) {
        body.title = postTitle.trim();
      }

      const response = await fetch('/api/posts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.status === 422 && result.needsTitle) {
        setNeedsTitle(true);
        setSubmitError(null);
        return;
      }

      if (!response.ok) {
        setSubmitError(result.error?.message || result.message || '등록에 실패했습니다.');
        return;
      }

      toast.success('글이 등록되었습니다.');
      setDialogOpen(false);
      resetDialog();
      // 리로드: 첫 페이지부터 다시
      setPosts([]);
      setPage(1);
      fetchPosts(1, false);
    } catch {
      setSubmitError('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Tabs + Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
            <button
              onClick={() => handleTabChange('latest')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === 'latest'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Clock className="h-3 w-3" />
              최신순
            </button>
            <button
              onClick={() => handleTabChange('popular')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === 'popular'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <TrendingUp className="h-3 w-3" />
              인기순
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetDialog();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" />글 등록
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>글 등록</DialogTitle>
                  <DialogDescription>
                    블로그 글 URL을 입력하면 제목이 자동으로 추출됩니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="postUrl">URL</Label>
                    <Input
                      id="postUrl"
                      placeholder="https://velog.io/@username/post-title"
                      value={postUrl}
                      onChange={(e) => setPostUrl(e.target.value)}
                    />
                  </div>
                  {needsTitle && (
                    <div className="space-y-2">
                      <Label htmlFor="postTitle">
                        제목 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="postTitle"
                        placeholder="글 제목을 직접 입력해주세요"
                        value={postTitle}
                        onChange={(e) => setPostTitle(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        제목을 자동으로 가져올 수 없습니다. 직접 입력해주세요.
                      </p>
                    </div>
                  )}
                  {submitError && <p className="text-sm text-destructive">{submitError}</p>}
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleManualSubmit}
                    disabled={submitting || !postUrl.trim() || (needsTitle && !postTitle.trim())}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        등록 중...
                      </>
                    ) : (
                      '등록'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 검색 + 파트 필터 */}
        <div className="space-y-2">
          {/* 검색바 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="제목, 작성자 검색... (Enter)"
              className="pl-8 h-8 text-xs"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchQuery(searchInput);
                }
              }}
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearchQuery('');
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 파트 필터 드롭다운 */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((prev) => !prev)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors',
                selectedParts.length > 0
                  ? 'border-foreground/30 text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              분야 필터
              {selectedParts.length > 0 && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white text-[10px] font-bold">
                  {selectedParts.length}
                </span>
              )}
            </button>

            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border bg-popover shadow-lg py-1">
                  <div className="px-3 py-2 border-b border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">분야</span>
                      {selectedParts.length > 0 && (
                        <button
                          onClick={() => setSelectedParts([])}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          초기화
                        </button>
                      )}
                    </div>
                  </div>
                  {PART_OPTIONS.map((part) => {
                    const isSelected = selectedParts.includes(part.value);
                    const style = getPartStyle(part.value);
                    return (
                      <button
                        key={part.value}
                        onClick={() => {
                          setSelectedParts((prev) =>
                            prev.includes(part.value)
                              ? prev.filter((p) => p !== part.value)
                              : [...prev, part.value]
                          );
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-px text-[11px] font-medium',
                            style.bg,
                            style.text
                          )}
                        >
                          {part.label}
                        </span>
                        <div
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                            isSelected ? 'bg-sky-500 border-sky-500' : 'border-border'
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 text-background" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 서브 정보 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>총 {totalCount}개</span>
          {searchQuery && (
            <span className="flex items-center gap-1">
              &ldquo;{searchQuery}&rdquo; 검색 결과
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearchQuery('');
                }}
                className="text-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {tab === 'popular' && (
            <span className="flex items-center gap-1 text-amber-500">
              <Flame className="h-3 w-3" />
              조회수 + 댓글 기반
            </span>
          )}
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <PostsListSkeleton />
      ) : error ? (
        <PageError message={error} />
      ) : posts.length > 0 ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {posts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                onView={trackPostView}
                onCommentCountChange={handleCommentCountChange}
                rank={tab === 'popular' ? index + 1 : undefined}
              />
            ))}
          </div>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-px" aria-hidden="true" />

          {/* Loading more */}
          {loadingMore && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* End indicator */}
          {!hasMore && posts.length > 0 && (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <p className="text-xs text-muted-foreground">{totalCount}개 모두 확인했어요</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">아직 등록된 포스트가 없습니다.</p>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function PostsPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Posts</p>
        <h1 className="text-xl font-semibold tracking-tight">포스트</h1>
        <p className="text-sm text-muted-foreground">스터디원들이 작성한 블로그 글 목록입니다.</p>
      </div>

      <Suspense fallback={<PostsListSkeleton />}>
        <PostsContent />
      </Suspense>
    </div>
  );
}
