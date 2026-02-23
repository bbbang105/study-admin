'use client';

import { useEffect, useState } from 'react';
import { Bookmark, ExternalLink, Calendar, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface CurationItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  category: string;
  tags: string[] | null;
  relevanceScore: number;
  sharedAt: string | null;
}

interface CurationData {
  items: CurationItem[];
  totalCount: number;
}

export default function CurationPage() {
  const [data, setData] = useState<CurationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'conference' | 'article'>('all');

  useEffect(() => {
    const fetchCuration = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/curation?category=${filter}`);
        if (!response.ok) {
          throw new Error('Failed to fetch curation data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError('큐레이션 데이터를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCuration();
  }, [filter]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'conference':
        return (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
            컨퍼런스
          </span>
        );
      case 'article':
        return (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            아티클
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            {category}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground text-sm">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive text-sm">{error}</div>
      </div>
    );
  }

  const filters: { value: 'all' | 'conference' | 'article'; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'conference', label: '컨퍼런스' },
    { value: 'article', label: '아티클' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Curation
        </p>
        <h1 className="text-xl font-semibold text-foreground">큐레이션</h1>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-1">
        {filters.map(({ value, label }) => (
          <Button
            key={value}
            variant="ghost"
            size="sm"
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground font-normal'
            }
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Curation Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">큐레이션 목록</span>
            </div>
            <span className="text-xs text-muted-foreground">
              총 {data?.totalCount ?? 0}개
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {data?.items && data.items.length > 0 ? (
            <div>
              {data.items.map((item, index) => (
                <div key={item.id}>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {/* Badges row */}
                      <div className="flex items-center gap-1.5">
                        {getCategoryBadge(item.category)}
                        {item.sharedAt && (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-success/10 text-success">
                            공유됨
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors block truncate"
                      >
                        {item.title}
                      </a>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {item.publishedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(item.publishedAt).toLocaleDateString('ko-KR')}
                            </span>
                          </div>
                        )}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            <span>
                              {item.tags.slice(0, 3).join(', ')}
                              {item.tags.length > 3 && ` +${item.tags.length - 3}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* External link */}
                    <Button variant="ghost" size="sm" asChild className="shrink-0 text-muted-foreground hover:text-foreground">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>

                  {index < data.items.length - 1 && (
                    <Separator className="border-border/40" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Bookmark className="h-8 w-8 opacity-30" />
              <p className="text-sm">아직 큐레이션된 컨텐츠가 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
