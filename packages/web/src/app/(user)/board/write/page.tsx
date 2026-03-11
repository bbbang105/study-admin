'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Lock, Megaphone } from 'lucide-react';

import { TiptapEditor } from '@/components/board/tiptap-editor';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { BOARD_CATEGORIES } from '@/lib/board-config';

export default function BoardWritePage() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<object | null>(null);
  const [contentText, setContentText] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [isNoticeBanner, setIsNoticeBanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/check')
      .then((res) => res.json())
      .then((data) => setIsAdmin(data.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, []);

  const visibleCategories = BOARD_CATEGORIES.filter(
    (cat) => cat.value !== 'notice' || isAdmin
  );

  const titleCharCount = title.length;
  const titleLimit = 200;

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
      const res = await fetch('/api/board', {
        method: 'POST',
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
        setError(result.message || result.error?.message || '게시글 작성에 실패했습니다.');
        return;
      }

      toast.success('게시글이 작성되었습니다.');
      router.push(`/board/${result.data.id}`);
    } catch {
      setError('서버 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

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
            className="h-8 w-8 shrink-0"
            onClick={() => router.push('/board')}
            aria-label="게시판으로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <h1 className="text-xl font-semibold tracking-tight">글 작성하기</h1>
        </div>
      </div>

      {/* Form Card */}
      <Card className="border-border/60 shadow-none">
        <CardContent className="space-y-5 pt-6">
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
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
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
                  titleCharCount >= titleLimit
                    ? 'text-destructive'
                    : 'text-muted-foreground'
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

            <TiptapEditor
              onChange={handleEditorChange}
              placeholder="내용을 입력해주세요..."
            />
          </div>

          {/* Notice Banner Toggle (admin + notice only) */}
          {isAdmin && category === 'notice' && (
            <div className="flex items-center justify-between rounded-lg border border-sky-200/60 bg-sky-50/50 px-4 py-3 dark:border-sky-800/40 dark:bg-sky-950/20">
              <div className="flex items-center gap-2.5">
                <Megaphone className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />

                <div className="space-y-0.5">
                  <Label
                    htmlFor="isNoticeBanner"
                    className="cursor-pointer text-sm font-medium"
                  >
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
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="space-y-0.5">
                <Label
                  htmlFor="isSecret"
                  className="cursor-pointer text-sm font-medium"
                >
                  비밀글 설정
                </Label>

                <p className="text-xs text-muted-foreground">
                  작성자와 관리자만 내용을 볼 수 있습니다.
                </p>
              </div>
            </div>

            <Switch
              id="isSecret"
              checked={isSecret}
              onCheckedChange={setIsSecret}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <p
          id="form-error"
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/board')}
          disabled={submitting}
          className="sm:w-auto"
        >
          취소
        </Button>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-sky-500 text-white hover:bg-sky-600 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              작성 중...
            </>
          ) : (
            '작성하기'
          )}
        </Button>
      </div>
    </div>
  );
}