'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MessageCircle,
  Pencil,
  Send,
  Shield,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { PageError } from '@/components/ui/page-state';
import { getDefaultAvatar } from '@/lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CommentMember {
  name: string;
  nickname: string | null;
  discordUsername: string;
  profileImageUrl: string | null;
  isAdmin: boolean;
}

interface Comment {
  id: string;
  postId: string;
  memberId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  member: CommentMember;
}

// ─────────────────────────────────────────────
// CommentItem
// ─────────────────────────────────────────────

function CommentItem({
  comment,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const displayName =
    comment.member.nickname || comment.member.name || comment.member.discordUsername;
  const avatarSrc = comment.member.profileImageUrl || getDefaultAvatar(displayName);
  const createdAt = new Date(comment.createdAt);
  const updatedAt = new Date(comment.updatedAt);
  const isEdited = updatedAt.getTime() - createdAt.getTime() > 1000;

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      await onEdit(comment.id, editContent.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditing(false);
      setEditContent(comment.content);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="flex gap-2.5 py-3 group">
      <Link href={`/members/${comment.memberId}`} className="shrink-0">
        <Avatar className="h-7 w-7">
          <AvatarImage src={avatarSrc} alt={displayName} />
          <AvatarFallback className="text-[10px]">{displayName[0]}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/members/${comment.memberId}`}
            className="text-xs font-medium text-foreground hover:underline underline-offset-2"
          >
            {displayName}
          </Link>
          {comment.member.isAdmin && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[10px] gap-0.5 bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
            >
              <Shield className="h-2.5 w-2.5" />
              관리자
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {createdAt.toLocaleDateString('ko-KR')}{' '}
            {createdAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isEdited && <span className="text-[10px] text-muted-foreground">(수정됨)</span>}
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-sm min-h-[60px] resize-none"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSave}
                disabled={saving || !editContent.trim()}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : '저장'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setEditing(false);
                  setEditContent(comment.content);
                }}
              >
                취소
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-0.5 leading-relaxed">
              {comment.content}
            </p>
            {/* Action buttons — visible on hover or for owner/admin */}
            {comment.isOwner && (
              <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                >
                  <Pencil className="h-3 w-3" />
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PostDetailPage
// ─────────────────────────────────────────────

export default function PostDetailPage() {
  const { id: postId } = useParams<{ id: string }>();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch post info from the list API (minimal — we mainly need title/author)
  const [postInfo, setPostInfo] = useState<{
    title: string;
    url: string;
    authorName: string;
    authorAvatar: string;
    authorId: string | null;
    publishedAt: string;
  } | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (!res.ok) throw new Error('Failed to load comments');
      const result = await res.json();
      setComments(result.data);
    } catch (err) {
      setError('댓글을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // Fetch post info by checking if it's in the list
  useEffect(() => {
    async function fetchPostInfo() {
      try {
        // Use a simple search to find this specific post
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
            });
          }
        }
      } catch {
        // Non-critical, UI still works without post info
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
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) {
        const result = await res.json();
        toast.error(result.message || '댓글 작성에 실패했습니다.');
        return;
      }
      toast.success('댓글이 작성되었습니다.');
      setNewComment('');
      fetchComments();
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const result = await res.json();
      toast.error(result.message || '수정에 실패했습니다.');
      return;
    }
    toast.success('댓글이 수정되었습니다.');
    fetchComments();
  };

  const handleDeleteComment = async (commentId: string) => {
    const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const result = await res.json();
      toast.error(result.message || '삭제에 실패했습니다.');
      return;
    }
    toast.success('댓글이 삭제되었습니다.');
    fetchComments();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmitComment();
    }
  };

  if (error && comments.length === 0) {
    return <PageError message={error} />;
  }

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
          </CardContent>
        </Card>
      )}

      {/* Comments section */}
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">댓글 {comments.length}개</span>
          </div>

          {/* Comment input */}
          <div className="flex gap-2 mb-4">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="댓글을 작성하세요... (Ctrl+Enter로 전송)"
              className="text-sm min-h-[60px] resize-none flex-1"
            />
            <Button
              size="sm"
              className="h-auto self-end"
              onClick={handleSubmitComment}
              disabled={submitting || !newComment.trim()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Comments list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length > 0 ? (
            <div className="divide-y divide-border/40">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-1.5">
              <MessageCircle className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">첫 댓글을 남겨보세요.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
