'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Pencil,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
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

interface CrawlSourceResult {
  sourceId: string;
  sourceName: string;
  success: boolean;
  itemsFound: number;
  newItemsAdded: number;
  error?: string;
}

interface CrawlSummary {
  totalSources: number;
  totalNewItems: number;
  successCount: number;
  failCount: number;
}

type CrawlStatus = 'idle' | 'crawling' | 'done' | 'error';

const categoryLabels: Record<string, string> = {
  conference: '컨퍼런스',
  article: '아티클',
};

const CRAWL_PERIOD_OPTIONS = [
  { label: '최근 1일', days: 1 },
  { label: '최근 3일', days: 3 },
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
  { label: '전체', days: 0 },
];

export default function AdminCurationPage() {
  const router = useRouter();
  const [data, setData] = useState<CurationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [crawlPeriod, setCrawlPeriod] = useState(7);

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

  // Edit form state
  const [editingSource, setEditingSource] = useState<CurationSource | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    url: '',
    category: 'article',
    rssUrl: '',
    tags: [] as string[],
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Crawl modal state
  const [crawlModalOpen, setCrawlModalOpen] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus>('idle');
  const [crawlTotalSources, setCrawlTotalSources] = useState(0);
  const [crawlProcessingName, setCrawlProcessingName] = useState('');
  const [crawlResults, setCrawlResults] = useState<CrawlSourceResult[]>([]);
  const [crawlSummary, setCrawlSummary] = useState<CrawlSummary | null>(null);
  const [crawlErrorMessage, setCrawlErrorMessage] = useState<string | null>(null);

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

  const startEditing = (source: CurationSource) => {
    setEditingSource(source);
    setEditForm({
      name: source.name,
      url: source.url,
      category: source.category,
      rssUrl: source.rssUrl || '',
      tags: source.tags || [],
    });
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingSource(null);
    setEditError(null);
  };

  const toggleEditTag = (tag: string) => {
    setEditForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleEditSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSource) return;
    setEditError(null);

    if (!editForm.name || !editForm.url) {
      setEditError('이름과 URL은 필수입니다.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/curation/${editingSource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          url: editForm.url,
          category: editForm.category,
          rssUrl: editForm.rssUrl || null,
          tags: editForm.tags,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '수정에 실패했습니다.');
      }

      setEditingSource(null);
      await fetchSources();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
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
    if (crawlStatus === 'crawling') return;

    // 모달 열고 초기화
    setCrawlModalOpen(true);
    setCrawlStatus('crawling');
    setCrawlTotalSources(0);
    setCrawlProcessingName('');
    setCrawlResults([]);
    setCrawlSummary(null);
    setCrawlErrorMessage(null);

    try {
      const body: Record<string, string> = {};
      if (crawlPeriod > 0) {
        const since = new Date();
        since.setDate(since.getDate() - crawlPeriod);
        body.since = since.toISOString();
      }

      const response = await fetch('/api/admin/curation/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('크롤링 실행에 실패했습니다.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('스트리밍을 읽을 수 없습니다.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === 'start') {
                setCrawlTotalSources(data.totalSources);
              } else if (eventType === 'processing') {
                setCrawlProcessingName(data.sourceName);
              } else if (eventType === 'progress') {
                setCrawlResults((prev) => [...prev, data.result]);
              } else if (eventType === 'complete') {
                setCrawlSummary(data.summary);
                if (data.message) setCrawlErrorMessage(data.message);
                setCrawlStatus('done');
              }
            } catch {
              // malformed JSON — skip
            }
            eventType = '';
          }
        }
      }

      // 스트림이 끝났는데 아직 done 아니면 완료 처리
      if (crawlStatus !== 'done') {
        setCrawlStatus('done');
      }
      await fetchSources();
    } catch (err) {
      setCrawlStatus('error');
      setCrawlErrorMessage(err instanceof Error ? err.message : '크롤링 실행에 실패했습니다.');
    }
  };

  const closeCrawlModal = () => {
    if (crawlStatus === 'crawling') return; // 진행 중엔 닫기 방지
    setCrawlModalOpen(false);
    setCrawlStatus('idle');
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
        <div className="flex gap-2 items-center">
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            value={crawlPeriod}
            onChange={(e) => setCrawlPeriod(Number(e.target.value))}
          >
            {CRAWL_PERIOD_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={handleCrawl} disabled={crawlStatus === 'crawling'}>
            {crawlStatus === 'crawling' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {crawlStatus === 'crawling' ? '크롤링 중...' : '크롤링 실행'}
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-2" />
            소스 추가
          </Button>
        </div>
      </div>

      {/* Crawl Progress Modal */}
      <Dialog open={crawlModalOpen} onOpenChange={(open) => { if (!open) closeCrawlModal(); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {crawlStatus === 'crawling' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              {crawlStatus === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              {crawlStatus === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
              {crawlStatus === 'crawling' ? '크롤링 진행 중' : crawlStatus === 'error' ? '크롤링 실패' : '크롤링 완료'}
            </DialogTitle>
            <DialogDescription>
              {crawlStatus === 'crawling' && crawlProcessingName && (
                <span>{crawlProcessingName} 처리 중...</span>
              )}
              {crawlStatus === 'done' && crawlSummary && (
                <span>
                  {crawlSummary.totalSources}개 소스에서 <strong className="text-primary">{crawlSummary.totalNewItems}개</strong> 새 아이템 수집
                </span>
              )}
              {crawlStatus === 'error' && crawlErrorMessage}
              {crawlErrorMessage && crawlStatus === 'done' && (
                <span>{crawlErrorMessage}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Progress Bar */}
          {crawlTotalSources > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{crawlResults.length} / {crawlTotalSources} 소스</span>
                <span>{Math.round((crawlResults.length / crawlTotalSources) * 100)}%</span>
              </div>
              <Progress value={(crawlResults.length / crawlTotalSources) * 100} className="h-2" />
            </div>
          )}

          {/* Summary Stats */}
          {crawlStatus === 'done' && crawlSummary && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="text-lg font-bold">{crawlSummary.totalSources}</div>
                <div className="text-xs text-muted-foreground">전체 소스</div>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-2.5">
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{crawlSummary.successCount}</div>
                <div className="text-xs text-muted-foreground">성공</div>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-500/10 p-2.5">
                <div className="text-lg font-bold text-destructive">{crawlSummary.failCount}</div>
                <div className="text-xs text-muted-foreground">실패</div>
              </div>
            </div>
          )}

          {/* Source Results List */}
          {crawlResults.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[300px] pr-1">
              {crawlResults.map((r) => (
                <div
                  key={r.sourceId}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
                    r.success
                      ? 'border-border bg-background'
                      : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  {r.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.sourceName}</div>
                    {r.success ? (
                      <div className="text-xs text-muted-foreground">
                        {r.itemsFound}개 발견, <span className="text-primary font-medium">{r.newItemsAdded}개 추가</span>
                      </div>
                    ) : (
                      <div className="text-xs text-destructive">{r.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCrawlModal}
              disabled={crawlStatus === 'crawling'}
            >
              {crawlStatus === 'crawling' ? '진행 중...' : '닫기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => router.push('/admin/curation/items')}
        >
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
                  {INTEREST_OPTIONS.map((tag) => {
                    const isSelected = newSource.tags.includes(tag);
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
                <TableHead className="w-[140px]">작업</TableHead>
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
                          {source.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                              {tag}
                            </span>
                          ))}
                          {source.tags.length > 4 && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                              +{source.tags.length - 4}
                            </span>
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
                          onClick={() => startEditing(source)}
                          disabled={updatingId === source.id}
                          title="수정"
                        >
                          <Pencil className="h-4 w-4" />
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

      {/* Edit Form */}
      {editingSource && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>소스 수정</CardTitle>
                <CardDescription>
                  &quot;{editingSource.name}&quot; 소스 정보를 수정합니다.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelEditing}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditSource} className="space-y-4">
              {editError && (
                <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-lg text-sm">
                  {editError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">이름</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-url">URL</Label>
                  <Input
                    id="edit-url"
                    type="url"
                    value={editForm.url}
                    onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">카테고리</Label>
                  <select
                    id="edit-category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
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
                <Label htmlFor="edit-rssUrl">RSS URL</Label>
                <Input
                  id="edit-rssUrl"
                  type="url"
                  value={editForm.rssUrl}
                  onChange={(e) => setEditForm({ ...editForm, rssUrl: e.target.value })}
                  placeholder="비워두면 크롤링 대상에서 제외됩니다"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  관심 태그
                  {editForm.tags.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {editForm.tags.length}개 선택
                    </span>
                  )}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map((tag) => {
                    const isSelected = editForm.tags.includes(tag);
                    return (
                      <Badge
                        key={tag}
                        variant={isSelected ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors text-xs"
                        onClick={() => toggleEditTag(tag)}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEditing}>
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
