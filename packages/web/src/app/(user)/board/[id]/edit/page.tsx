'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Lock, Megaphone } from 'lucide-react';
import { TiptapEditor } from '@/components/board/tiptap-editor';
import { BOARD_CATEGORIES } from '@/lib/board-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { BoardFormSkeleton, PageError } from '@/components/ui/page-state';

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function BoardEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<object | null>(null);
  const [contentText, setContentText] = useState('');
  const [initialContent, setInitialContent] = useState<object | null>(null);
  const [isSecret, setIsSecret] = useState(false);
  const [isNoticeBanner, setIsNoticeBanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setFetchError(null);

      try {
        const [postRes, meRes, adminRes] = await Promise.all([
          fetch(`/api/board/${id}`),
          fetch('/api/auth/me'),
          fetch('/api/admin/check'),
        ]);

        const adminData = adminRes.ok ? await adminRes.json() : null;
        const isAdminUser = adminData?.isAdmin === true;
        setIsAdmin(isAdminUser);

        if (!postRes.ok) {
          const postResult = await postRes.json();
          if (postRes.status === 403) {
            setFetchError('이 게시글에 접근할 권한이 없습니다.');
          } else if (postRes.status === 404) {
            setFetchError('게시글을 찾을 수 없습니다.');
          } else {
            setFetchError(postResult.message || '게시글을 불러오는데 실패했습니다.');
          }
          return;
        }

        const postResult = await postRes.json();
        const post = postResult.data.post;

        const meData = meRes.ok ? await meRes.json() : null;
        const currentMemberId = meData?.memberId ?? null;

        // Ownership check — only post author can edit
        if (!isAdminUser && currentMemberId !== post.memberId) {
          router.replace('/board');
          return;
        }

        // Pre-populate form fields
        setCategory(post.category);
        setTitle(post.title);
        setIsSecret(post.isSecret);
        setIsNoticeBanner(post.isNoticeBanner ?? false);

        // Set initial content for TiptapEditor (JSON object from DB)
        if (post.content && typeof post.content === 'object') {
          setInitialContent(post.content);
          setContent(post.content);
        }
        setContentText(post.contentText ?? '');
      } catch {
        setFetchError('서버 오류가 발생했습니다. 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, router]);

  const visibleCategories = BOARD_CATEGORIES.filter((cat) => cat.value !== 'notice' || isAdmin);

  const handleEditorChange = (json: object, text: string) => {
    setContent(json);
    setContentText(text);
  };

  const handleSubmit = async () => {
    if (!category) {
      setError('카테고리를 선택해주세요.');
      return;
    }
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    if (!contentText.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/board/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          content,
          contentText: contentText.trim(),
          isSecret,
          isNoticeBanner: category === 'notice' ? isNoticeBanner : false,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.message || result.error?.message || '게시글 수정에 실패했습니다.');
        return;
      }

      toast.success('게시글이 수정되었습니다.');
      router.push(`/board/${id}`);
    } catch {
      setError('서버 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <BoardFormSkeleton />;

  if (fetchError) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/board/${id}`)}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            게시글로 돌아가기
          </Button>
        </div>
        <PageError message={fetchError} />
      </div>
    );
  }

  const titleCharCount = title.length;
  const titleLimit = 200;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page Header */}
      <div className="space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Community
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => router.push(`/board/${id}`)}
            aria-label="게시글로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">글 수정하기</h1>
        </div>
      </div>

      {/* Form Card */}
      <Card className="border-border/60 shadow-none">
        <CardContent className="pt-6 space-y-5">
          {/* Category Select */}
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-sm font-medium">
              카테고리 <span className="text-destructive">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="w-full sm:w-48">
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
                {visibleCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                    {cat.value === 'notice' && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                        (관리자 전용)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="title" className="text-sm font-medium">
                제목 <span className="text-destructive">*</span>
              </Label>
              <span
                className={`text-xs tabular-nums ${
                  titleCharCount >= titleLimit ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {titleCharCount}/{titleLimit}
              </span>
            </div>
            <Input
              id="title"
              placeholder="제목을 입력해주세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={titleLimit}
              className="text-sm"
            />
          </div>

          {/* Editor */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              내용 <span className="text-destructive">*</span>
            </Label>
            {initialContent !== null && (
              <TiptapEditor
                content={initialContent}
                onChange={handleEditorChange}
                placeholder="내용을 입력해주세요..."
              />
            )}
          </div>

          {/* Notice Banner Toggle (admin + notice only) */}
          {isAdmin && category === 'notice' && (
            <div className="flex items-center justify-between rounded-lg border border-sky-200/60 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/20 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Megaphone className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <div className="space-y-0.5">
                  <Label htmlFor="isNoticeBanner" className="text-sm font-medium cursor-pointer">
                    상단 배너에 표시
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    모든 페이지 상단에 공지 배너로 표시됩니다. 기존 배너는 자동 해제됩니다.
                  </p>
                </div>
              </div>
              <Switch
                id="isNoticeBanner"
                checked={isNoticeBanner}
                onCheckedChange={setIsNoticeBanner}
              />
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/40" />

          {/* Secret Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="space-y-0.5">
                <Label htmlFor="isSecret" className="text-sm font-medium cursor-pointer">
                  비밀글 설정
                </Label>
                <p className="text-xs text-muted-foreground">
                  작성자와 관리자만 내용을 볼 수 있습니다.
                </p>
              </div>
            </div>
            <Switch id="isSecret" checked={isSecret} onCheckedChange={setIsSecret} />
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive text-center rounded-md bg-destructive/10 px-4 py-2.5 border border-destructive/20">
          {error}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-3 pb-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/board/${id}`)}
          disabled={submitting}
          className="sm:w-auto"
        >
          취소
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-sky-500 hover:bg-sky-600 text-white sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              수정 중...
            </>
          ) : (
            '수정하기'
          )}
        </Button>
      </div>
    </div>
  );
}
