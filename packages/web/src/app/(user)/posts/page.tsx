'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FileText, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  memberName: string;
  memberDiscordUsername: string;
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

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/posts?page=${currentPage}&pageSize=10`);
        if (!response.ok) {
          throw new Error('Failed to fetch posts');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError('포스트 목록을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [currentPage]);

  const handlePageChange = (page: number) => {
    router.push(`/posts?page=${page}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-3 pt-5 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">전체 포스트</span>
          </div>
          <span className="text-xs text-muted-foreground">
            총 {data?.pagination.totalCount ?? 0}개
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-5">
        {data?.posts && data.posts.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="w-[50%] text-xs font-medium text-muted-foreground h-9">제목</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">작성자</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">회차</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">작성일</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground h-9">링크</TableHead>
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
                        className="text-sm text-primary hover:underline underline-offset-4 line-clamp-1 font-medium"
                      >
                        {post.title}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80 py-2.5">
                      {post.memberName || post.memberDiscordUsername}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {post.roundNumber ? (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {post.roundNumber}회차
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-2.5">
                      {new Date(post.publishedAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-right py-2.5">
                      <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-6">
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
                <span className="text-xs text-muted-foreground px-3 tabular-nums">
                  {currentPage} / {data.pagination.totalPages}
                </span>
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
        <p className="text-sm text-muted-foreground">
          스터디원들이 작성한 블로그 글 목록입니다.
        </p>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-sm text-muted-foreground">로딩 중...</div>
        </div>
      }>
        <PostsContent />
      </Suspense>
    </div>
  );
}
