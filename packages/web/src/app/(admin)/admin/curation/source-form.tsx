'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { INTEREST_OPTIONS } from '@blog-study/shared/config';

const categoryLabels: Record<string, string> = {
  conference: '컨퍼런스',
  article: '아티클',
};

export interface SourceFormValues {
  name: string;
  url: string;
  category: string;
  rssUrl: string;
  tags: string[];
}

export interface SourceFormProps {
  initialValues: SourceFormValues;
  categories: string[];
  onSubmit: (values: SourceFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
}

export function SourceForm({
  initialValues,
  categories,
  onSubmit,
  onCancel,
  submitLabel,
  submitting,
  error,
}: SourceFormProps) {
  const [values, setValues] = useState<SourceFormValues>(initialValues);

  const toggleTag = (tag: string) => {
    setValues((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="source-name">이름</Label>
          <Input
            id="source-name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="예: GeekNews"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-url">URL</Label>
          <Input
            id="source-url"
            type="url"
            value={values.url}
            onChange={(e) => setValues({ ...values, url: e.target.value })}
            placeholder="https://news.hada.io"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-category">카테고리</Label>
          <select
            id="source-category"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={values.category}
            onChange={(e) => setValues({ ...values, category: e.target.value })}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabels[cat] || cat}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-rssUrl">RSS URL (선택)</Label>
        <Input
          id="source-rssUrl"
          type="url"
          value={values.rssUrl}
          onChange={(e) => setValues({ ...values, rssUrl: e.target.value })}
          placeholder="비워두면 자동 감지를 시도합니다"
        />
      </div>
      <div className="space-y-2">
        <Label>
          관심 태그 (선택)
          {values.tags.length > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              {values.tags.length}개 선택
            </span>
          )}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {INTEREST_OPTIONS.map((tag) => {
            const isSelected = values.tags.includes(tag);
            return (
              <Badge
                key={tag}
                variant={isSelected ? 'default' : 'outline'}
                className="cursor-pointer transition-colors text-xs"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? '저장 중...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}
