'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageError, PostsListSkeleton } from '@/components/ui/page-state';
import { PartBadge } from '@/components/ui/part-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Post {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  memberNickname: string;
  memberDiscordUsername: string;
  memberPart: string | null;
  roundNumber: number | null;
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

function PostsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [data, setData] = useState<PostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 수동 글 등록 모달 state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [postUrl, setPostUrl] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [needsTitle, setNeedsTitle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/posts?page=${currentPage}&pageSize=10`);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError('포스트 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePageChange = (page: number) => {
    router.push(`/posts?page=${page}`);
  };

  const trackPostView = (postId: string) => {
    fetch(`/api/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
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
        setSubmitError(result.message || '등록에 실패했습니다.');
        return;
      }

      // 성공 → 모달 닫기 + 목록 새로고침
      toast.success('글이 등록되었습니다.');
      setDialogOpen(false);
      resetDialog();
      fetchPosts();
    } catch {
      setSubmitError('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PostsListSkeleton />;
  }

  if (error) {
    return <PageError message={error} />;
  }

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-3 pt-5 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">전체 포스트</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              총 {data?.pagination.totalCount ?? 0}개
            </span>
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
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-5">
        {data?.posts && data.posts.length > 0 ? (
          <>
            {/* Mobile: compact list */}
            <div className="lg:hidden divide-y divide-border/40">
              {data.posts.map((post) => (
                <a
                  key={post.id}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 py-3 group"
                  onClick={() => trackPostView(post.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                      <span>{post.memberNickname || post.memberDiscordUsername}</span>
                      {post.memberPart && (
                        <>
                          <span>·</span>
                          <PartBadge part={post.memberPart} size="sm" />
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(post.publishedAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  <span className="flex items-center gap-0.5 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-0.5 transition-colors">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">(새 탭에서 열기)</span>
                  </span>
                </a>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    <TableHead className="w-[40%] text-xs font-medium text-muted-foreground h-9">
                      제목
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                      작성자
                    </TableHead>
                    <TableHead className="text-center text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                      파트
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                      회차
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                      작성일
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                      링크
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.posts.map((post) => (
                    <TableRow key={post.id} className="border-border/40 hover:bg-muted/30">
                      <TableCell className="py-2.5">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={post.title}
                          className="flex max-w-full items-center gap-1 overflow-hidden text-sm font-medium text-primary hover:underline underline-offset-4"
                          onClick={() => trackPostView(post.id)}
                        >
                          <span className="truncate">{post.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="sr-only">(새 탭에서 열기)</span>
                        </a>
                      </TableCell>
                      <TableCell
                        className="max-w-32 py-2.5 text-sm text-foreground/80 whitespace-nowrap"
                        title={post.memberNickname || post.memberDiscordUsername}
                      >
                        <span className="block truncate">
                          {post.memberNickname || post.memberDiscordUsername}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-2.5 whitespace-nowrap">
                        {post.memberPart ? (
                          <PartBadge part={post.memberPart} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 whitespace-nowrap">
                        {post.roundNumber ? (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {post.roundNumber}회차
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground py-2.5 whitespace-nowrap">
                        {new Date(post.publishedAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="text-right py-2.5 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          aria-label={`${post.title} (새 탭에서 열기)`}
                        >
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackPostView(post.id)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1 mt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                  이전
                </Button>
                {(() => {
                  const total = data.pagination.totalPages;
                  const maxVisible = 10;
                  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  const end = Math.min(total, start + maxVisible - 1);
                  start = Math.max(1, end - maxVisible + 1);

                  const pages: number[] = [];
                  for (let i = start; i <= end; i++) pages.push(i);

                  return pages.map((page) => (
                    <Button
                      key={page}
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={`h-8 w-8 p-0 text-xs tabular-nums ${
                        page === currentPage
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {page}
                    </Button>
                  ));
                })()}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= data.pagination.totalPages}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  다음
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">아직 등록된 포스트가 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PostsPage() {
  return (
    <div className="space-y-5">
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
