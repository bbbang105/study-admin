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

interface CurationSource {
  id: string;
  url: string;
  name: string;
  category: string;
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
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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
        body: JSON.stringify(newSource),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add source');
      }

      // Reset form and refresh
      setNewSource({ url: '', name: '', category: 'article' });
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
      source.category.toLowerCase().includes(query)
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
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" />
          소스 추가
        </Button>
      </div>

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
                    <TableCell className="font-medium">{source.name}</TableCell>
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
