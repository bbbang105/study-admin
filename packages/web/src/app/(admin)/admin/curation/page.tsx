'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Rss, Plus, Search, FileText, Calendar, Loader2, RefreshCw, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoading, PageError } from '@/components/ui/page-state';
import { CrawlModal } from './crawl-modal';
import type { CrawlStatus, CrawlSourceResult, CrawlSummary } from './crawl-modal';
import { SourceForm } from './source-form';
import type { SourceFormValues } from './source-form';
import { SourcesTable } from './sources-table';
import type { CurationSource } from './sources-table';

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
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Edit form state
  const [editingSource, setEditingSource] = useState<CurationSource | null>(null);
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

  const handleAddSource = async (values: SourceFormValues) => {
    setAddError(null);

    if (!values.url || !values.name) {
      setAddError('URL과 이름은 필수입니다.');
      return;
    }

    try {
      setAdding(true);
      const response = await fetch('/api/admin/curation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: values.url,
          name: values.name,
          category: values.category,
          tags: values.tags.length > 0 ? values.tags : undefined,
          rssUrl: values.rssUrl || undefined,
        }),
      });

      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || 'Failed to add source');
      }

      setShowAddForm(false);
      await fetchSources();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '소스 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const handleEditSource = async (values: SourceFormValues) => {
    if (!editingSource) return;
    setEditError(null);

    if (!values.name || !values.url) {
      setEditError('이름과 URL은 필수입니다.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/curation/${editingSource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          url: values.url,
          category: values.category,
          rssUrl: values.rssUrl || null,
          tags: values.tags,
        }),
      });

      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || '수정에 실패했습니다.');
      }

      setEditingSource(null);
      await fetchSources();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
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
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (source: CurationSource) => {
    if (
      !confirm(
        `"${source.name}" 소스를 삭제하시겠습니까?\n수집된 ${source.itemCount}개의 아이템도 함께 삭제됩니다.`,
      )
    ) {
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
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCrawl = async () => {
    if (crawlStatus === 'crawling') return;

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
              const parsed = JSON.parse(line.slice(6));

              if (eventType === 'start') {
                setCrawlTotalSources(parsed.totalSources);
              } else if (eventType === 'processing') {
                setCrawlProcessingName(parsed.sourceName);
              } else if (eventType === 'progress') {
                setCrawlResults((prev) => [...prev, parsed.result]);
              } else if (eventType === 'complete') {
                setCrawlSummary(parsed.summary);
                if (parsed.message) setCrawlErrorMessage(parsed.message);
                setCrawlStatus('done');
              }
            } catch {
              // malformed JSON — skip
            }
            eventType = '';
          }
        }
      }

      // Stream ended without a 'complete' event — treat as done
      setCrawlStatus((prev) => (prev !== 'done' ? 'done' : prev));
      await fetchSources();
    } catch (err) {
      setCrawlStatus('error');
      setCrawlErrorMessage(
        err instanceof Error ? err.message : '크롤링 실행에 실패했습니다.',
      );
    }
  };

  const closeCrawlModal = (open: boolean) => {
    if (!open && crawlStatus === 'crawling') return;
    setCrawlModalOpen(open);
    if (!open) setCrawlStatus('idle');
  };

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} />;

  const filteredSources =
    data?.sources.filter((source) => {
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">큐레이션 소스 관리</h1>
          <p className="text-muted-foreground">
            외부 컨퍼런스 및 아티클 수집 소스를 관리하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
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
      <CrawlModal
        open={crawlModalOpen}
        onOpenChange={closeCrawlModal}
        status={crawlStatus}
        totalSources={crawlTotalSources}
        processingName={crawlProcessingName}
        results={crawlResults}
        summary={crawlSummary}
        errorMessage={crawlErrorMessage}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 소스</CardTitle>
            <Rss className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats.totalSources || 0}개</div>
            <p className="text-xs text-muted-foreground">활성 {data?.stats.activeSources || 0}개</p>
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
            <p className="text-xs text-muted-foreground">공유됨 {data?.stats.sharedItems || 0}개</p>
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
            <CardDescription>큐레이션할 외부 사이트를 추가합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourceForm
              initialValues={{ name: '', url: '', category: 'article', rssUrl: '', tags: [] }}
              categories={data?.categories || []}
              onSubmit={handleAddSource}
              onCancel={() => {
                setShowAddForm(false);
                setAddError(null);
              }}
              submitLabel="추가"
              submitting={adding}
              error={addError}
            />
          </CardContent>
        </Card>
      )}

      {/* Sources Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>소스 목록</CardTitle>
              <CardDescription>{filteredSources.length}개의 소스</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="검색..."
                className="pl-8 w-full sm:w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SourcesTable
            sources={filteredSources}
            onToggleActive={handleToggleActive}
            onEdit={(source) => {
              setEditingSource(source);
              setEditError(null);
            }}
            onDelete={handleDelete}
            updatingId={updatingId}
            searchQuery={searchQuery}
          />
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingSource(null);
                  setEditError(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <SourceForm
              key={editingSource.id}
              initialValues={{
                name: editingSource.name,
                url: editingSource.url,
                category: editingSource.category,
                rssUrl: editingSource.rssUrl || '',
                tags: editingSource.tags || [],
              }}
              categories={data?.categories || []}
              onSubmit={handleEditSource}
              onCancel={() => {
                setEditingSource(null);
                setEditError(null);
              }}
              submitLabel="저장"
              submitting={saving}
              error={editError}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
