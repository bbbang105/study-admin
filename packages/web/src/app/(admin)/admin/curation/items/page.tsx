'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLinkIcon } from '@/components/ui/external-link';
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

interface CurationItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  category: string;
  tags: string[] | null;
  relevanceScore: number;
  isShared: boolean;
  collectedAt: string;
  sourceId: string | null;
  sourceName: string | null;
}

interface SourceOption {
  id: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const categoryLabels: Record<string, string> = {
  conference: '컨퍼런스',
  article: '아티클',
};

export default function CurationItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CurationItem[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<CurationItem | null>(null);

  // Filters
  const [category, setCategory] = useState('all');
  const [sourceId, setSourceId] = useState('all');

  const fetchItems = useCallback(async (page: number, cat: string, src: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '12',
        category: cat,
        sourceId: src,
      });
      const response = await fetch(`/api/admin/curation/items?${params}`);
      if (!response.ok) throw new Error('Failed to fetch items');

      const data = await response.json();
      setItems(data.items);
      setPagination(data.pagination);
      setSources(data.sources);
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(pagination.page, category, sourceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (newCategory: string, newSourceId: string) => {
    setCategory(newCategory);
    setSourceId(newSourceId);
    fetchItems(1, newCategory, newSourceId);
  };

  const handlePageChange = (newPage: number) => {
    fetchItems(newPage, category, sourceId);
  };

  const handleDelete = async (item: CurationItem) => {
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeletingId(deleteTarget.id);
      const response = await fetch(`/api/admin/curation/items/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete item');

      setDeleteTarget(null);
      // Refresh current page
      fetchItems(pagination.page, category, sourceId);
    } catch (err) {
      console.error('Error deleting item:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/curation')} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-1" />
          돌아가기
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">수집된 아이템</h1>
          <p className="text-muted-foreground">
            총 {pagination.total}개의 아이템
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          value={category}
          onChange={(e) => handleFilterChange(e.target.value, sourceId)}
        >
          <option value="all">전체 카테고리</option>
          <option value="conference">컨퍼런스</option>
          <option value="article">아티클</option>
        </select>

        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring max-w-[200px]"
          value={sourceId}
          onChange={(e) => handleFilterChange(category, e.target.value)}
        >
          <option value="all">전체 소스</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
          수집된 아이템이 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <CardContent className="flex flex-col gap-3 pt-5 flex-1">
                {/* Top row: category badge */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {categoryLabels[item.category] || item.category}
                  </Badge>
                  {item.isShared && (
                    <Badge variant="default" className="text-xs">
                      공유됨
                    </Badge>
                  )}
                </div>

                {/* Title with external link */}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm hover:underline line-clamp-2 flex items-start gap-1 group"
                >
                  <span className="flex-1">{item.title}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 mt-0.5 shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(새 탭에서 열기)</span>
                  </span>
                </a>

                {/* Source + Date */}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {item.sourceName && <div>{item.sourceName}</div>}
                  <div>{formatDate(item.publishedAt)}</div>
                </div>

                {/* Tags (max 3) */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 4 && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                        +{item.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Delete button */}
                <div className="mt-auto pt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span className="ml-1">삭제</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            이전
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            다음
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>아이템 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; 아이템을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
