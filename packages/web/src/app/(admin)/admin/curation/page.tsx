'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Rss,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  ToggleLeft,
  ToggleRight,
  FileText,
  Calendar,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { INTEREST_OPTIONS } from '@blog-study/shared/config';

interface CurationSource {
  id: string;
  url: string;
  name: string;
  category: string;
  rssUrl: string | null;
  tags: string[] | null;
  isActive: boolean;
  createdAt: string;
  itemCount: number;
}

interface CurationStats {
  totalSources: number;
  activeSources: number;
  totalItems: number;
  sharedItems: number;
}

interface CurationData {
  sources: CurationSource[];
  stats: CurationStats;
  categories: string[];
}

interface CrawlResult {
  results: {
    sourceId: string;
    sourceName: string;
    success: boolean;
    itemsFound: number;
    newItemsAdded: number;
    error?: string;
  }[];
  summary: {
    totalSources: number;
    totalNewItems: number;
    successCount: number;
    failCount: number;
  };
  message?: string;
}

const categoryLabels: Record<string, string> = {
  conference: '컨퍼런스',
  article: '아티클',
};

export default function AdminCurationPage() {
  const [data, setData] = useState<CurationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Add form state
  const [newSource, setNewSource] = useState({
    url: '',
    name: '',
    category: 'article',
    rssUrl: '',
    tags: [] as string[],
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Crawl state
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/curation');
      if (!response.ok) {
        throw new Error('Failed to fetch curation sources');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('큐레이션 소스를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const toggleTag = (tag: string) => {
    setNewSource((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newSource.url || !newSource.name) {
      setAddError('URL과 이름은 필수입니다.');
      return;
    }

    try {
      setAdding(true);
      const response = await fetch('/api/admin/curation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newSource.url,
          name: newSource.name,
          category: newSource.category,
          tags: newSource.tags.length > 0 ? newSource.tags : undefined,
          rssUrl: newSource.rssUrl || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add source');
      }

      // Reset form and refresh
      setNewSource({ url: '', name: '', category: 'article', rssUrl: '', tags: [] });
      setShowAddForm(false);
      await fetchSources();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '소스 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (source: CurationSource) => {
    try {
      setUpdatingId(source.id);
      const response = await fetch(`/api/admin/curation/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !source.isActive }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle source status');
      }

      await fetchSources();
    } catch (err) {
      console.error('Error toggling source:', err);
      alert('상태 변경에 실패했습니다.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (source: CurationSource) => {
    if (!confirm(`"${source.name}" 소스를 삭제하시겠습니까?\n수집된 ${source.itemCount}개의 아이템도 함께 삭제됩니다.`)) {
      return;
    }

    try {
      setUpdatingId(source.id);
      const response = await fetch(`/api/admin/curation/${source.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete source');
      }

      await fetchSources();
    } catch (err) {
      console.error('Error deleting source:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCrawl = async () => {
    if (crawling) return;

    try {
      setCrawling(true);
      setCrawlResult(null);
      const response = await fetch('/api/admin/curation/crawl', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('크롤링 실행에 실패했습니다.');
      }

      const result: CrawlResult = await response.json();
      setCrawlResult(result);
      await fetchSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : '크롤링 실행에 실패했습니다.');
    } finally {
      setCrawling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  // Filter sources
  const filteredSources = data?.sources.filter((source) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      source.name.toLowerCase().includes(query) ||
      source.url.toLowerCase().includes(query) ||
      source.category.toLowerCase().includes(query) ||
      (source.tags || []).some((t) => t.toLowerCase().includes(query))
    );
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">큐레이션 소스 관리</h1>
          <p className="text-muted-foreground">
            외부 컨퍼런스 및 아티클 수집 소스를 관리하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCrawl} disabled={crawling}>
            {crawling ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {crawling ? '크롤링 중...' : '크롤링 실행'}
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-2" />
            소스 추가
          </Button>
        </div>
      </div>

      {/* Crawl Result Alert */}
      {crawlResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">
                  {crawlResult.message || (
                    <>
                      크롤링 완료: {crawlResult.summary.totalSources}개 소스에서{' '}
                      <span className="text-primary font-bold">{crawlResult.summary.totalNewItems}개</span> 새 아이템 수집
                    </>
                  )}
                </p>
                {crawlResult.results.length > 0 && (
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {crawlResult.results.map((r) => (
                      <div key={r.sourceId}>
                        {r.success ? (
                          <span>{r.sourceName}: {r.itemsFound}개 발견, {r.newItemsAdded}개 추가</span>
                        ) : (
                          <span className="text-destructive">{r.sourceName}: 실패 - {r.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCrawlResult(null)}
              >
                닫기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 소스</CardTitle>
            <Rss className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats.totalSources || 0}개</div>
            <p className="text-xs text-muted-foreground">
              활성 {data?.stats.activeSources || 0}개
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">수집된 아이템</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats.totalItems || 0}개</div>
            <p className="text-xs text-muted-foreground">
              공유됨 {data?.stats.sharedItems || 0}개
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">컨퍼런스</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.sources.filter((s) => s.category === 'conference').length || 0}개
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">아티클</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.sources.filter((s) => s.category === 'article').length || 0}개
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>새 소스 추가</CardTitle>
            <CardDescription>
              큐레이션할 외부 사이트를 추가합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSource} className="space-y-4">
              {addError && (
                <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-lg text-sm">
                  {addError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    value={newSource.name}
                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                    placeholder="예: GeekNews"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={newSource.url}
                    onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                    placeholder="https://news.hada.io"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">카테고리</Label>
                  <select
                    id="category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={newSource.category}
                    onChange={(e) => setNewSource({ ...newSource, category: e.target.value })}
                  >
                    {data?.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryLabels[cat] || cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rssUrl">RSS URL (선택)</Label>
                <Input
                  id="rssUrl"
                  type="url"
                  value={newSource.rssUrl}
                  onChange={(e) => setNewSource({ ...newSource, rssUrl: e.target.value })}
                  placeholder="비워두면 자동 감지를 시도합니다"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  관심 태그 (선택)
                  {newSource.tags.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {newSource.tags.length}개 선택
                    </span>
                  )}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={newSource.tags.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors text-xs"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={adding}>
                  {adding ? '추가 중...' : '추가'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddError(null);
                  }}
                >
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sources Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>소스 목록</CardTitle>
              <CardDescription>
                {filteredSources.length}개의 소스
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="검색..."
                className="pl-8 w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>태그</TableHead>
                <TableHead className="text-center">아이템</TableHead>
                <TableHead className="text-center">상태</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-[120px]">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSources.length > 0 ? (
                filteredSources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{source.name}</span>
                        {source.rssUrl && (
                          <span className="ml-1.5 text-xs text-muted-foreground" title={source.rssUrl}>
                            RSS
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-sm"
                      >
                        {source.url.length > 40
                          ? source.url.substring(0, 40) + '...'
                          : source.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categoryLabels[source.category] || source.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {source.tags && source.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {source.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {source.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{source.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{source.itemCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={source.isActive ? 'default' : 'secondary'}>
                        {source.isActive ? '활성' : '비활성'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(source.createdAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(source)}
                          disabled={updatingId === source.id}
                          title={source.isActive ? '비활성화' : '활성화'}
                        >
                          {source.isActive ? (
                            <ToggleRight className="h-4 w-4 text-success" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(source)}
                          disabled={updatingId === source.id}
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? '검색 결과가 없습니다.' : '등록된 소스가 없습니다.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
