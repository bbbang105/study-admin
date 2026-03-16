'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Pin,
  Lock,
  Pencil,
  MessageSquare,
} from 'lucide-react';
import { TiptapRenderer } from '@/components/board/tiptap-renderer';
import { PollDisplay, type Poll } from '@/components/board/poll-display';
import { CommentTree, type Comment } from '@/components/board/comment-tree';
import { CommentForm } from '@/components/board/comment-form';
import { DeletePostDialog } from '@/components/board/delete-post-dialog';
import { categoryBadgeConfig } from '@/lib/board-config';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Button } from '@/components/ui/button';
import { BoardDetailSkeleton, PageError } from '@/components/ui/page-state';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Post {
  id: string;
  memberId: string;
  memberName: string;
  memberProfileImage: string | null;
  memberDiscordId: string;
  memberIsAdmin: boolean;
  category: string;
  title: string;
  content: object;
  contentText: string;
  isSecret: boolean;
  isPinned: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CurrentUser {
  memberId: string | null;
  isAdmin: boolean;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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

function CategoryBadge({ category }: { category: string }) {
  const config = categoryBadgeConfig[category];
  if (!config) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const router = useRouter();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    memberId: null,
    isAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user (auth/me + admin check)
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const [meRes, adminRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/admin/check'),
        ]);

        const meData = meRes.ok ? await meRes.json() : null;
        const adminData = adminRes.ok ? await adminRes.json() : null;

        setCurrentUser({
          memberId: meData?.memberId ?? null,
          isAdmin: adminData?.isAdmin === true,
        });
      } catch {
        // Non-critical — fall back to no permissions
      }
    };

    fetchCurrentUser();
  }, []);

  // Fetch post + comments
  const fetchPost = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [postRes, pollsRes] = await Promise.all([
        fetch(`/api/board/${postId}`),
        fetch(`/api/board/${postId}/polls`),
      ]);

      const postResult = await postRes.json();

      if (!postRes.ok) {
        if (postRes.status === 403) {
          setError('비밀글은 작성자와 관리자만 볼 수 있습니다.');
        } else if (postRes.status === 404) {
          setError('게시글을 찾을 수 없습니다.');
        } else {
          setError(postResult.message || '게시글을 불러오는데 실패했습니다.');
        }
        return;
      }

      setPost(postResult.data.post);
      setComments(postResult.data.comments);

      // Fetch polls (non-critical)
      if (pollsRes.ok) {
        const pollsResult = await pollsRes.json();
        setPolls(pollsResult.data.polls || []);
      }
    } catch {
      setError('서버 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // Refresh only comments (after comment actions)
  const refreshComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/${postId}`);
      if (!res.ok) return;
      const result = await res.json();
      setComments(result.data.comments);
      setPost((prev) =>
        prev ? { ...prev, commentCount: result.data.post.commentCount } : prev
      );
    } catch {
      // Fail silently — user can manually refresh
    }
  }, [postId]);

  // Refresh polls after voting
  const refreshPolls = useCallback(async () => {
    try {
      // Add cache busting timestamp to bypass browser cache
      const res = await fetch(`/api/board/${postId}/polls?t=${Date.now()}`);
      if (!res.ok) return;
      const result = await res.json();
      setPolls(result.data.polls || []);
    } catch {
      // Fail silently
    }
  }, [postId]);

  if (loading) return <BoardDetailSkeleton />;
  if (error || !post) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/board')}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            목록으로
          </Button>
        </div>
        <PageError message={error ?? '게시글을 찾을 수 없습니다.'} />
      </div>
    );
  }

  const isOwner = !!currentUser.memberId && currentUser.memberId === post.memberId;
  const canEdit = isOwner;
  const canDelete = isOwner || currentUser.isAdmin;
  const avatarSeed = post.memberDiscordId || post.memberName;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Page header ── */}
      <div className="space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Community
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => router.push('/board')}
            aria-label="게시판으로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">게시판</h1>
        </div>
      </div>

      {/* ── Post card ── */}
      <div className="rounded-xl border border-border/60 bg-card shadow-none overflow-hidden">
        {/* Post header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40 space-y-4">
          {/* Category + badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={post.category} />
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Pin className="h-2.5 w-2.5" />
                고정
              </span>
            )}
            {post.isSecret && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <Lock className="h-2.5 w-2.5" />
                비밀글
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold leading-snug tracking-tight text-foreground break-words">
            {post.title}
          </h2>

          {/* Author + meta row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <MemberAvatar
                memberId={post.memberId}
                name={post.memberName}
                seed={avatarSeed}
                imageUrl={post.memberProfileImage}
                size="md"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/members/${post.memberId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-medium leading-none hover:text-primary transition-colors"
                  >
                    {post.memberName}
                  </Link>
                  {post.memberIsAdmin && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                      관리자
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  {formatRelativeTime(post.createdAt)}
                  {post.updatedAt !== post.createdAt && (
                    <span className="ml-1.5 text-muted-foreground/60">(수정됨)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-1">
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Link href={`/board/${post.id}/edit`}>
                      <Pencil className="h-3.5 w-3.5" />
                      수정
                    </Link>
                  </Button>
                )}
                {canDelete && (
                  <DeletePostDialog postId={post.id} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Post content */}
        <div className="px-6 py-6">
          <TiptapRenderer content={post.content} />
        </div>
      </div>

      {/* ── Polls section ── */}
      {polls.length > 0 && (
        <div className="space-y-4">
          {polls.map((poll) => (
            <PollDisplay
              key={poll.id}
              postId={postId}
              poll={poll}
              onRefresh={refreshPolls}
            />
          ))}
        </div>
      )}

      {/* ── Comments section ── */}
      <div className="rounded-xl border border-border/60 bg-card shadow-none overflow-hidden">
        {/* Comment section header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border/40">
          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">댓글</span>
          {post.commentCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-semibold px-2 py-0.5 tabular-nums">
              {post.commentCount}
            </span>
          )}
        </div>

        {/* Comment tree */}
        <div className="px-6">
          <CommentTree
            comments={comments}
            postAuthorId={post.memberId}
            currentMemberId={currentUser.memberId ?? ''}
            isAdmin={currentUser.isAdmin}
            onRefresh={refreshComments}
          />
        </div>

        {/* Comment form */}
        <div className="px-6 py-5 border-t border-border/40 bg-muted/10">
          <p className="text-xs font-medium text-muted-foreground mb-3">댓글 작성</p>
          <CommentForm
            postId={post.id}
            onSuccess={refreshComments}
          />
        </div>
      </div>
    </div>
  );
}
