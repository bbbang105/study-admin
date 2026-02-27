'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Pin,
  Lock,
  MessageSquare,
  PenSquare,
  ChevronLeft,
  ChevronRight,
  LayoutList,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { BoardListSkeleton, PageError } from '@/components/ui/page-state';
import { BOARD_CATEGORIES, categoryBadgeConfig, getCategoryLabel } from '@/lib/board-config';
import { getDefaultAvatar } from '@/lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface BoardPost {
  id: string;
  memberId: string;
  memberName: string;
  memberProfileImage: string | null;
  memberDiscordId: string;
  category: string;
  title: string;
  contentText: string;
  isSecret: boolean;
  isPinned: boolean;
  commentCount: number;
  createdAt: string;
  isMasked: boolean;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface BoardData {
  pinnedPosts: BoardPost[];
  posts: BoardPost[];
  pagination: Pagination;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/\. /g, '.')
    .replace(/\.$/, '');
}

type CategoryValue = (typeof BOARD_CATEGORIES)[number]['value'];

const ALL_TABS: { value: 'all' | CategoryValue; label: string }[] = [
  { value: 'all', label: '전체' },
  ...BOARD_CATEGORIES,
];

// ─────────────────────────────────────────────
// Category Badge
// ─────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const config = categoryBadgeConfig[category];
  if (!config) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Post Row (desktop table)
// ─────────────────────────────────────────────

function PostTableRow({ post }: { post: BoardPost }) {
  const router = useRouter();
  const displayName = post.isMasked ? '익명' : post.memberName || '알 수 없음';
  const avatarSeed = post.isMasked ? 'anonymous' : post.memberDiscordId || post.memberName;

  return (
    <TableRow
      className="border-border/40 hover:bg-muted/30 cursor-pointer"
      onClick={() => router.push(`/board/${post.id}`)}
    >
      <TableCell className="py-2.5 w-[90px]">
        <CategoryBadge category={post.category} />
      </TableCell>
      <TableCell className="py-2.5 max-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {post.isSecret && (
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          )}
          <span className="text-sm font-medium text-foreground truncate">
            {post.isMasked ? '비밀글입니다' : post.title}
          </span>
          {post.commentCount > 0 && (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] text-sky-500 font-medium">
              <MessageSquare className="h-3 w-3" />
              {post.commentCount}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {!post.isMasked ? (
            <Link
              href={`/members/${post.memberId}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            >
              <Avatar className="h-5 w-5 ring-1 ring-border shrink-0 hover:ring-primary transition-colors">
                <AvatarImage
                  src={post.memberProfileImage ?? getDefaultAvatar(avatarSeed)}
                  alt={displayName}
                />
                <AvatarFallback className="text-[9px] font-medium">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Avatar className="h-5 w-5 ring-1 ring-border shrink-0">
              <AvatarImage
                src={getDefaultAvatar(avatarSeed)}
                alt={displayName}
              />
              <AvatarFallback className="text-[9px] font-medium">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="text-sm text-foreground/80 truncate max-w-[80px]">{displayName}</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
        {formatRelativeTime(post.createdAt)}
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────
// Post Card (mobile)
// ─────────────────────────────────────────────

function PostCard({ post }: { post: BoardPost }) {
  const displayName = post.isMasked ? '익명' : post.memberName || '알 수 없음';
  const avatarSeed = post.isMasked ? 'anonymous' : post.memberDiscordId || post.memberName;

  return (
    <Link href={`/board/${post.id}`} className="block group">
      <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <CategoryBadge category={post.category} />
            {post.isSecret && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
            )}
          </div>
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {post.isMasked ? '비밀글입니다' : post.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              {!post.isMasked ? (
                <Link
                  href={`/members/${post.memberId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                >
                  <Avatar className="h-4 w-4 ring-1 ring-border shrink-0 hover:ring-primary transition-colors">
                    <AvatarImage
                      src={post.memberProfileImage ?? getDefaultAvatar(avatarSeed)}
                      alt={displayName}
                    />
                    <AvatarFallback className="text-[8px]">
                      {displayName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              ) : (
                <Avatar className="h-4 w-4 ring-1 ring-border shrink-0">
                  <AvatarImage
                    src={getDefaultAvatar(avatarSeed)}
                    alt={displayName}
                  />
                  <AvatarFallback className="text-[8px]">
                    {displayName.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <span>{displayName}</span>
            </div>
            <span>·</span>
            <span className="tabular-nums">{formatRelativeTime(post.createdAt)}</span>
            {post.commentCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5 text-sky-500 font-medium">
                  <MessageSquare className="h-3 w-3" />
                  {post.commentCount}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Pinned Post Row (desktop)
// ─────────────────────────────────────────────

function PinnedTableRow({ post }: { post: BoardPost }) {
  const router = useRouter();
  const displayName = post.memberName || '알 수 없음';
  const avatarSeed = post.memberDiscordId || post.memberName;

  return (
    <TableRow
      className="border-border/40 bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/70 dark:hover:bg-amber-950/20 cursor-pointer"
      onClick={() => router.push(`/board/${post.id}`)}
    >
      <TableCell className="py-2.5 w-[90px]">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <Pin className="h-2.5 w-2.5" />
          공지
        </span>
      </TableCell>
      <TableCell className="py-2.5 max-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">
            {post.title}
          </span>
          {post.commentCount > 0 && (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] text-sky-500 font-medium">
              <MessageSquare className="h-3 w-3" />
              {post.commentCount}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/members/${post.memberId}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            <Avatar className="h-5 w-5 ring-1 ring-border shrink-0 hover:ring-primary transition-colors">
              <AvatarImage
                src={post.memberProfileImage ?? getDefaultAvatar(avatarSeed)}
                alt={displayName}
              />
              <AvatarFallback className="text-[9px] font-medium">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <span className="text-sm text-foreground/80 truncate max-w-[80px]">{displayName}</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
        {formatRelativeTime(post.createdAt)}
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────
// Pinned Post Card (mobile)
// ─────────────────────────────────────────────

function PinnedCard({ post }: { post: BoardPost }) {
  const displayName = post.memberName || '알 수 없음';
  const avatarSeed = post.memberDiscordId || post.memberName;

  return (
    <Link href={`/board/${post.id}`} className="block group">
      <div className="flex items-start gap-3 py-3 border-b border-amber-200/60 dark:border-amber-800/30 last:border-0">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <Pin className="h-2.5 w-2.5" />
              공지
            </span>
          </div>
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {post.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Link
                href={`/members/${post.memberId}`}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <Avatar className="h-4 w-4 ring-1 ring-border shrink-0 hover:ring-primary transition-colors">
                  <AvatarImage
                    src={post.memberProfileImage ?? getDefaultAvatar(avatarSeed)}
                    alt={displayName}
                  />
                  <AvatarFallback className="text-[8px]">
                    {displayName.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <span>{displayName}</span>
            </div>
            <span>·</span>
            <span className="tabular-nums">{formatRelativeTime(post.createdAt)}</span>
            {post.commentCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5 text-sky-500 font-medium">
                  <MessageSquare className="h-3 w-3" />
                  {post.commentCount}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Inner Content
// ─────────────────────────────────────────────

function BoardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get('category') ?? 'all';
  const currentPage = parseInt(searchParams.get('page') ?? '1', 10);

  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBoard = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (currentCategory !== 'all') params.set('category', currentCategory);
        params.set('page', String(currentPage));
        params.set('pageSize', '20');

        const response = await fetch(`/api/board?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch board posts');
        }
        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError('게시글 목록을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBoard();
  }, [currentCategory, currentPage]);

  const handleCategoryChange = (value: string) => {
    const params = new URLSearchParams();
    if (value !== 'all') params.set('category', value);
    params.set('page', '1');
    router.push(`/board?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams();
    if (currentCategory !== 'all') params.set('category', currentCategory);
    params.set('page', String(page));
    router.push(`/board?${params.toString()}`);
  };

  if (loading) {
    return <BoardListSkeleton />;
  }

  if (error) {
    return <PageError message={error} />;
  }

  const pinnedPosts = data?.pinnedPosts ?? [];
  const posts = data?.posts ?? [];
  const pagination = data?.pagination;
  const totalCount = (pagination?.totalCount ?? 0) + pinnedPosts.length;

  // Show pinned section only when viewing all or notice category
  const showPinned = pinnedPosts.length > 0 && (currentCategory === 'all' || currentCategory === 'notice');

  return (
    <div className="space-y-4">
      {/* Controls: Tabs + Write button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={currentCategory} onValueChange={handleCategoryChange}>
          <TabsList className="h-9 gap-0.5 bg-muted/60 p-1 flex-wrap">
            {ALL_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-7 px-2.5 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-muted-foreground tabular-nums">
            총 {totalCount}개
          </span>
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
            <Link href="/board/write">
              <PenSquare className="h-3.5 w-3.5" />
              글쓰기
            </Link>
          </Button>
        </div>
      </div>

      {/* Pinned notices section */}
      {showPinned && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/10 overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-amber-200/60 dark:border-amber-800/30">
            <Pin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-500 uppercase tracking-wider">
              공지사항
            </span>
          </div>

          {/* Desktop: pinned table */}
          <div className="hidden md:block">
            <Table>
              <TableBody>
                {pinnedPosts.map((post) => (
                  <PinnedTableRow key={post.id} post={post} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: pinned cards */}
          <div className="md:hidden px-4">
            {pinnedPosts.map((post) => (
              <PinnedCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}

      {/* Normal posts */}
      <Card className="border-border/60 shadow-none overflow-hidden">
        {posts.length > 0 ? (
          <>
            {/* Desktop: table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    <TableHead className="w-[90px] text-xs font-medium text-muted-foreground h-9">
                      분류
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground h-9">
                      제목
                    </TableHead>
                    <TableHead className="w-[130px] text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                      작성자
                    </TableHead>
                    <TableHead className="w-[100px] text-xs font-medium text-muted-foreground h-9 whitespace-nowrap">
                      날짜
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <PostTableRow key={post.id} post={post} />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: card list */}
            <CardContent className="md:hidden px-4 py-0">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </CardContent>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1 border-t border-border/40 py-4">
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
                  const total = pagination.totalPages;
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
                  disabled={currentPage >= pagination.totalPages}
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
            <LayoutList className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {currentCategory === 'all'
                ? '아직 작성된 게시글이 없습니다.'
                : `${getCategoryLabel(currentCategory)} 카테고리에 게시글이 없습니다.`}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 h-8 text-xs">
              <Link href="/board/write">첫 글 작성하기</Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page export with Suspense
// ─────────────────────────────────────────────

export default function BoardPage() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Community
        </p>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold tracking-tight">게시판</h1>
          <p className="text-sm text-muted-foreground">스터디원들과 자유롭게 소통하세요.</p>
        </div>
      </div>

      <Suspense fallback={<BoardListSkeleton />}>
        <BoardContent />
      </Suspense>
    </div>
  );
}
