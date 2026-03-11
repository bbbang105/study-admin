'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  ExternalLink,
  Moon,
  UserX,
  Clock,
  UserCheck,
  GraduationCap,
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
import { MemberFormDialog } from './member-form-dialog';
import { DeleteMemberDialog } from './delete-member-dialog';
import { PendingMemberCard } from './pending-member-card';
import { AdminMembersSkeleton, PageError } from '@/components/ui/page-state';
import { PartBadge } from '@/components/ui/part-badge';
import { MEMBER_STATUS_CONFIG } from '@/lib/member-config';
import { cn } from '@/lib/utils';

interface AttendanceStats {
  total: number;
  submitted: number;
  late: number;
  absent: number;
}

interface Member {
  id: string;
  discordId: string;
  discordUsername: string;
  name: string;
  nickname: string;
  part: string;
  blogUrl: string;
  rssUrl: string | null;
  rssConsent: boolean;
  profileImageUrl: string | null;
  bio: string | null;
  interests: string[] | null;
  resolution: string | null;
  status: string;
  onboardingCompleted: boolean;
  dormantUsed: boolean;
  dormantStartRound: number | null;
  postCount: number;
  attendanceRate: number;
  attendanceStats: AttendanceStats;
  joinedAt: string;
  updatedAt: string;
}

interface MemberCounts {
  pending_approval: number;
  active: number;
  inactive: number;
  dormant: number;
  ob: number;
  withdrawn: number;
  total: number;
}

interface MembersData {
  members: Member[];
  grouped: Record<string, Member[]>;
  counts: MemberCounts;
}


export default function AdminMembersPage() {
  const [data, setData] = useState<MembersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/members');
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('멤버 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAddMember = () => {
    setEditingMember(null);
    setIsFormOpen(true);
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setIsFormOpen(true);
  };

  const handleDeleteMember = (member: Member) => {
    setDeletingMember(member);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingMember(null);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingMember(null);
    fetchMembers();
  };

  const handleDeleteClose = () => {
    setDeletingMember(null);
  };

  const handleDeleteSuccess = () => {
    setDeletingMember(null);
    fetchMembers();
  };

  const handleApproveMember = async (memberId: string, targetStatus: string) => {
    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (response.ok) fetchMembers();
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleRejectMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' }),
      });
      if (response.ok) fetchMembers();
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  // Filter members
  const filteredMembers = data?.members.filter((member) => {
    // Status filter
    if (statusFilter !== 'all' && member.status !== statusFilter) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        member.name.toLowerCase().includes(query) ||
        member.discordUsername.toLowerCase().includes(query) ||
        member.part.toLowerCase().includes(query) ||
        member.blogUrl.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  if (loading) return <AdminMembersSkeleton />;
  if (error) return <PageError message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">멤버 관리</h1>
          <p className="text-muted-foreground">
            스터디 참가자를 관리하세요.
          </p>
        </div>
        <Button onClick={handleAddMember} className="self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />
          멤버 추가
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: '전체', count: data?.counts.total, icon: Users },
          { key: 'pending_approval', label: '승인대기', count: data?.counts.pending_approval, icon: Clock },
          { key: 'active', label: '활성', count: data?.counts.active, icon: UserCheck },
          { key: 'ob', label: 'OB', count: data?.counts.ob, icon: GraduationCap },
          { key: 'dormant', label: '휴면', count: data?.counts.dormant, icon: Moon },
          { key: 'inactive', label: '비활성', count: data?.counts.inactive, icon: UserX },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            <span className={cn(
              'ml-0.5 rounded-full px-1.5 py-0.5 text-xs',
              statusFilter === tab.key
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-background text-foreground'
            )}>
              {tab.count ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>멤버 목록</CardTitle>
              <CardDescription>
                {statusFilter === 'all' ? '전체' : MEMBER_STATUS_CONFIG[statusFilter]?.label} 멤버 {filteredMembers.length}명
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Label htmlFor="members-search" className="sr-only">
                  멤버 검색
                </Label>
                <Input
                  id="members-search"
                  placeholder="검색..."
                  className="pl-8 w-full sm:w-[200px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {statusFilter === 'pending_approval' && filteredMembers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredMembers.map((member) => (
                <PendingMemberCard
                  key={member.id}
                  member={member}
                  onApprove={handleApproveMember}
                  onReject={handleRejectMember}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="md:hidden space-y-3">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <div key={member.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.discordUsername}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant={member.rssConsent ? 'outline' : 'secondary'} className="text-[10px] px-1.5 py-0">
                            RSS {member.rssConsent ? 'ON' : 'OFF'}
                          </Badge>
                          <Badge variant={MEMBER_STATUS_CONFIG[member.status]?.variant || 'secondary'}>
                            {MEMBER_STATUS_CONFIG[member.status]?.label || member.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <PartBadge part={member.part} />
                        <span className="text-xs text-muted-foreground">포스트 {member.postCount}개</span>
                        <span className="text-xs text-muted-foreground">출석률 {member.attendanceRate}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <a
                          href={member.blogUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          블로그
                        </a>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditMember(member)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMember(member)}
                            disabled={member.status === 'withdrawn'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? '검색 결과가 없습니다.' : statusFilter === 'pending_approval' ? '승인 대기 중인 멤버가 없습니다.' : '등록된 멤버가 없습니다.'}
                  </div>
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>파트</TableHead>
                      <TableHead>Discord</TableHead>
                      <TableHead>블로그</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">포스트</TableHead>
                      <TableHead className="text-right">출석률</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium whitespace-nowrap">{member.name}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <PartBadge part={member.part} />
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {member.discordUsername}
                          </TableCell>
                          <TableCell>
                            <a
                              href={member.blogUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              블로그
                            </a>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={member.rssConsent ? 'outline' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                RSS {member.rssConsent ? 'ON' : 'OFF'}
                              </Badge>
                              <Badge variant={MEMBER_STATUS_CONFIG[member.status]?.variant || 'secondary'}>
                                {MEMBER_STATUS_CONFIG[member.status]?.label || member.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{member.postCount}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{member.attendanceRate}%</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditMember(member)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteMember(member)}
                                disabled={member.status === 'withdrawn'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {searchQuery ? '검색 결과가 없습니다.' : statusFilter === 'pending_approval' ? '승인 대기 중인 멤버가 없습니다.' : '등록된 멤버가 없습니다.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Member Form Dialog */}
      <MemberFormDialog
        open={isFormOpen}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        member={editingMember}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteMemberDialog
        open={!!deletingMember}
        onClose={handleDeleteClose}
        onSuccess={handleDeleteSuccess}
        member={deletingMember}
      />
    </div>
  );
}
