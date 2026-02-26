'use client';

import {
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TagList } from '@/components/ui/tag-list';

const categoryLabels: Record<string, string> = {
  conference: '컨퍼런스',
  article: '아티클',
};

export interface CurationSource {
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

export interface SourcesTableProps {
  sources: CurationSource[];
  onToggleActive: (source: CurationSource) => void;
  onEdit: (source: CurationSource) => void;
  onDelete: (source: CurationSource) => void;
  updatingId: string | null;
  searchQuery: string;
}

export function SourcesTable({
  sources,
  onToggleActive,
  onEdit,
  onDelete,
  updatingId,
  searchQuery,
}: SourcesTableProps) {
  const emptyMessage = searchQuery ? '검색 결과가 없습니다.' : '등록된 소스가 없습니다.';

  return (
    <>
      {/* Desktop Table (md+) */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="whitespace-nowrap">카테고리</TableHead>
              <TableHead>태그</TableHead>
              <TableHead className="text-center whitespace-nowrap">아이템</TableHead>
              <TableHead className="text-center whitespace-nowrap">상태</TableHead>
              <TableHead className="whitespace-nowrap">등록일</TableHead>
              <TableHead className="w-[120px] whitespace-nowrap">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.length > 0 ? (
              sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{source.name}</span>
                      {source.rssUrl && (
                        <span
                          className="ml-1.5 text-xs text-muted-foreground"
                          title={source.rssUrl}
                        >
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
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline">
                      {categoryLabels[source.category] || source.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {source.tags && source.tags.length > 0 ? (
                      <div className="max-w-[160px]">
                        <TagList tags={source.tags} limit={3} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {source.itemCount}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    <Badge variant={source.isActive ? 'default' : 'secondary'}>
                      {source.isActive ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {new Date(source.createdAt).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleActive(source)}
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
                        onClick={() => onEdit(source)}
                        disabled={updatingId === source.id}
                        title="수정"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(source)}
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
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards (< md) */}
      <div className="md:hidden space-y-3">
        {sources.length > 0 ? (
          sources.map((source) => (
            <div key={source.id} className="rounded-lg border bg-card p-4 space-y-3">
              {/* Name + status row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{source.name}</div>
                  {source.rssUrl && (
                    <span className="text-xs text-muted-foreground">RSS</span>
                  )}
                </div>
                <Badge
                  variant={source.isActive ? 'default' : 'secondary'}
                  className="shrink-0"
                >
                  {source.isActive ? '활성' : '비활성'}
                </Badge>
              </div>

              {/* URL */}
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline text-sm break-all"
              >
                <span className="truncate">{source.url}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>

              {/* Category + item count */}
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">
                  {categoryLabels[source.category] || source.category}
                </Badge>
                <span className="text-muted-foreground text-xs">아이템 {source.itemCount}개</span>
                <span className="text-muted-foreground text-xs ml-auto">
                  {new Date(source.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>

              {/* Tags */}
              {source.tags && source.tags.length > 0 && (
                <TagList tags={source.tags} />
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 pt-1 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleActive(source)}
                  disabled={updatingId === source.id}
                >
                  {source.isActive ? (
                    <ToggleRight className="h-4 w-4 text-success" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="ml-1 text-xs">
                    {source.isActive ? '비활성화' : '활성화'}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(source)}
                  disabled={updatingId === source.id}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="ml-1 text-xs">수정</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(source)}
                  disabled={updatingId === source.id}
                  className="ml-auto"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="ml-1 text-xs text-destructive">삭제</span>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
        )}
      </div>
    </>
  );
}
