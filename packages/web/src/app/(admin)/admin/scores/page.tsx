'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Search,
  Send,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageError, PageLoading } from '@/components/ui/page-state';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  name: string;
  nickname: string;
  discordUsername: string;
  part: string;
  status: string;
}

interface ScoreRecord {
  id: string;
  memberId: string;
  type: string;
  points: number;
  description: string;
  date: string;
  createdAt: string;
}

interface MemberScoreSummary {
  memberId: string;
  name: string;
  nickname: string;
  discordUsername: string;
  part: string;
  totalScore: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  blog_post: '블로그 포스트',
  discord_message: '디스코드 메시지',
  discord_thread: '스레드 댓글',
  discord_reaction: '리액션',
  admin_manual: '관리자 부여',
  post_view: '글 조회',
};

const TOP_MEMBERS_COUNT = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActivityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABELS[type] ?? type;
}

function getActivityTypeBadgeClass(type: string): string {
  if (type === 'admin_manual') {
    return 'bg-sky-100 text-sky-700 border-sky-200';
  }
  if (type === 'blog_post') {
    return 'bg-violet-100 text-violet-700 border-violet-200';
  }
  if (type === 'discord_message') {
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  }
  if (type === 'discord_thread') {
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }
  if (type === 'discord_reaction') {
    return 'bg-cyan-100 text-cyan-700 border-cyan-200';
  }
  if (type === 'post_view') {
    return 'bg-teal-100 text-teal-700 border-teal-200';
  }
  return 'bg-muted text-muted-foreground border-border';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MemberSelectorProps {
  members: Member[];
  selectedMemberId: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function MemberSelector({
  members,
  selectedMemberId,
  onSelect,
  searchQuery,
  onSearchChange,
}: MemberSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 + ESC 키로 드롭다운 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredMembers = members.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.nickname.toLowerCase().includes(q) ||
      m.discordUsername.toLowerCase().includes(q) ||
      m.part.toLowerCase().includes(q)
    );
  });

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
    onSearchChange('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm',
          'transition-colors hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isOpen ? 'border-ring ring-2 ring-ring ring-offset-2' : 'border-input'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedMember ? (
          <span className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">{selectedMember.name}</span>
            <span className="text-muted-foreground text-xs">@{selectedMember.discordUsername}</span>
            <span className="text-muted-foreground text-xs">{selectedMember.part}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">멤버를 선택하세요...</span>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-background shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="이름, 닉네임, 파트 검색..."
                className="pl-8 h-8 text-sm"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>
          <ul role="listbox" className="max-h-[240px] overflow-y-auto py-1">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <li
                  key={member.id}
                  role="option"
                  aria-selected={member.id === selectedMemberId}
                  onClick={() => handleSelect(member.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    member.id === selectedMemberId && 'bg-accent text-accent-foreground'
                  )}
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{member.name}</span>
                  <span className="text-muted-foreground text-xs">@{member.discordUsername}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{member.part}</span>
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                검색 결과가 없습니다.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminScoresPage() {
  // ── Members state ──
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  // ── Selector state ──
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // ── Score history state ──
  const [scoreRecords, setScoreRecords] = useState<ScoreRecord[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Score grant form state ──
  const [points, setPoints] = useState<number>(10);
  const [pointsInput, setPointsInput] = useState<string>('10');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ── Delete state ──
  const [deletingRecord, setDeletingRecord] = useState<ScoreRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Top members summary state ──
  const [topMembers, setTopMembers] = useState<MemberScoreSummary[]>([]);
  const [topMembersLoading, setTopMembersLoading] = useState(true);

  // ─── Fetch all members ────────────────────────────────────────────────────

  const fetchMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      const response = await fetch('/api/admin/members');
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      const result = await response.json();
      // GET /api/admin/members returns { members: [...], grouped: {}, counts: {} }
      // Note: this endpoint does NOT wrap in { success, data } — it returns the object directly
      const memberList: Member[] = (result.members ?? result.data?.members ?? []).filter(
        (m: Member) => m.status !== 'withdrawn'
      );
      setMembers(memberList);
    } catch (err) {
      setMembersError('멤버 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  // ─── Fetch score history for selected member ──────────────────────────────

  const fetchScoreHistory = useCallback(async (memberId: string) => {
    if (!memberId) {
      setScoreRecords([]);
      setTotalScore(0);
      return;
    }
    try {
      setHistoryLoading(true);
      const response = await fetch(`/api/scores?memberId=${encodeURIComponent(memberId)}&limit=50`);
      if (!response.ok) {
        throw new Error('Failed to fetch score history');
      }
      const result = await response.json();
      if (result.success) {
        setScoreRecords(result.data.records ?? []);
        setTotalScore(result.data.totalScore ?? 0);
      }
    } catch (err) {
      console.error('Error fetching score history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // ─── Fetch top members by total score ────────────────────────────────────

  const fetchTopMembers = useCallback(async (allMembers: Member[]) => {
    if (allMembers.length === 0) return;
    try {
      setTopMembersLoading(true);
      // 단일 summary API로 전체 멤버 총점 조회
      const res = await fetch('/api/admin/scores/summary');
      if (!res.ok) throw new Error('Failed to fetch score summary');
      const json = await res.json();
      if (!json.success) throw new Error('Score summary error');

      const scoreMap: Record<string, number> = json.data ?? {};

      const summaries: MemberScoreSummary[] = allMembers
        .map((m) => ({
          memberId: m.id,
          name: m.name,
          nickname: m.nickname,
          discordUsername: m.discordUsername,
          part: m.part,
          totalScore: scoreMap[m.id] ?? 0,
        }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, TOP_MEMBERS_COUNT);

      setTopMembers(summaries);
    } catch (err) {
      console.error('Error fetching top members:', err);
    } finally {
      setTopMembersLoading(false);
    }
  }, []);

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (members.length > 0) {
      fetchTopMembers(members);
    }
  }, [members, fetchTopMembers]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchScoreHistory(selectedMemberId);
    }
  }, [selectedMemberId, fetchScoreHistory]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleMemberSelect = (id: string) => {
    setSelectedMemberId(id);
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handlePointsInputChange = (value: string) => {
    setPointsInput(value);
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed !== 0) {
      setPoints(parsed);
    }
  };

  const handlePointsBlur = () => {
    // Normalize the input on blur
    if (pointsInput === '' || pointsInput === '-' || parseInt(pointsInput, 10) === 0) {
      setPointsInput(String(points));
    } else {
      setPointsInput(String(points));
    }
  };

  const toggleSign = () => {
    const next = -points;
    setPoints(next);
    setPointsInput(String(next));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!selectedMemberId) {
      setSubmitError('멤버를 선택해주세요.');
      return;
    }
    if (points === 0) {
      setSubmitError('포인트는 0이 될 수 없습니다.');
      return;
    }
    if (!description.trim()) {
      setSubmitError('설명을 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/admin/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMemberId,
          points,
          description: description.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? '점수 부여에 실패했습니다.');
      }

      if (result.success === false) {
        throw new Error(result.message ?? '점수 부여에 실패했습니다.');
      }

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
      setDescription('');
      // Refresh score history and top members
      await fetchScoreHistory(selectedMemberId);
      await fetchTopMembers(members);
    } catch (err) {
      const message = err instanceof Error ? err.message : '점수 부여에 실패했습니다.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecord) return;

    try {
      setDeleteLoading(true);
      setDeleteError(null);
      const response = await fetch('/api/admin/scores', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoreId: deletingRecord.id }),
      });

      if (!response.ok) {
        const result = await response.json();
        setDeleteError(result.error?.message ?? '삭제에 실패했습니다.');
        return;
      }

      setDeletingRecord(null);
      await fetchScoreHistory(selectedMemberId);
      await fetchTopMembers(members);
    } catch {
      setDeleteError('서버 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteClose = () => {
    setDeletingRecord(null);
    setDeleteError(null);
  };

  // ─── Derived values ────────────────────────────────────────────────────────

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const isFormValid = selectedMemberId !== '' && points !== 0 && description.trim().length > 0;

  // ─── Render guards ─────────────────────────────────────────────────────────

  if (membersLoading) return <PageLoading />;
  if (membersError) return <PageError message={membersError} />;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-5 w-5 text-sky-500" />
            <h1 className="text-3xl font-bold tracking-tight">점수 관리</h1>
          </div>
          <p className="text-muted-foreground">멤버에게 활동 점수를 직접 부여하거나 차감하세요.</p>
        </div>
      </div>

      {/* ── Top members summary ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">점수 상위 멤버</CardTitle>
          </div>
          <CardDescription>누적 활동 점수 기준 상위 {TOP_MEMBERS_COUNT}명</CardDescription>
        </CardHeader>
        <CardContent>
          {topMembersLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              불러오는 중...
            </div>
          ) : topMembers.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              아직 점수 내역이 없습니다.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {topMembers.map((member, index) => (
                <button
                  key={member.memberId}
                  type="button"
                  onClick={() => handleMemberSelect(member.memberId)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                    'hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/20',
                    selectedMemberId === member.memberId
                      ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/20'
                      : 'border-border'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      index === 0
                        ? 'bg-amber-100 text-amber-700'
                        : index === 1
                          ? 'bg-slate-100 text-slate-600'
                          : index === 2
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.part}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        'text-sm font-bold',
                        member.totalScore >= 0 ? 'text-emerald-600' : 'text-rose-500'
                      )}
                    >
                      {member.totalScore >= 0 ? '+' : ''}
                      {member.totalScore.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">점</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Main content: selector + form + history ──────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column: member selector + grant form */}
        <div className="space-y-4 lg:col-span-2">
          {/* Member selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">멤버 선택</CardTitle>
              <CardDescription>점수를 관리할 멤버를 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <MemberSelector
                members={members}
                selectedMemberId={selectedMemberId}
                onSelect={handleMemberSelect}
                searchQuery={memberSearchQuery}
                onSearchChange={setMemberSearchQuery}
              />
              {selectedMember && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{selectedMember.name}</span>
                    <span className="text-muted-foreground ml-1.5">
                      @{selectedMember.discordUsername}
                    </span>
                  </div>
                  {!historyLoading && (
                    <div className="shrink-0">
                      <span
                        className={cn(
                          'text-sm font-bold',
                          totalScore >= 0 ? 'text-emerald-600' : 'text-rose-500'
                        )}
                      >
                        {totalScore >= 0 ? '+' : ''}
                        {totalScore.toLocaleString()}점
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score grant form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">점수 부여 / 차감</CardTitle>
              <CardDescription>관리자 수동으로 점수를 조정합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Points input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="score-points">
                    포인트
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={cn(
                        'h-9 w-9 shrink-0 transition-colors',
                        points < 0
                          ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/20'
                      )}
                      onClick={toggleSign}
                      aria-label={points >= 0 ? '차감으로 전환' : '부여로 전환'}
                    >
                      {points >= 0 ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </Button>
                    <Input
                      id="score-points"
                      type="number"
                      value={pointsInput}
                      onChange={(e) => handlePointsInputChange(e.target.value)}
                      onBlur={handlePointsBlur}
                      className={cn(
                        'font-mono font-semibold transition-colors',
                        points > 0
                          ? 'text-emerald-600'
                          : points < 0
                            ? 'text-rose-500'
                            : 'text-foreground'
                      )}
                      placeholder="10"
                      step="1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    양수: 점수 부여 / 음수: 점수 차감. +/- 버튼으로 전환 가능합니다.
                  </p>
                </div>

                {/* Description input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="score-description">
                    설명
                  </label>
                  <Input
                    id="score-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="ex) 블로그 글 추가 기여, 특별 활동 보상..."
                    maxLength={300}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {description.length}/300
                  </p>
                </div>

                {/* Feedback */}
                {submitError && (
                  <p className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-md px-3 py-2">
                    {submitError}
                  </p>
                )}
                {submitSuccess && (
                  <p className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-md px-3 py-2">
                    점수가 성공적으로 부여되었습니다.
                  </p>
                )}

                {/* Submit */}
                <Button type="submit" disabled={submitting || !isFormValid} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  {submitting
                    ? '처리 중...'
                    : points >= 0
                      ? `+${points}점 부여`
                      : `${points}점 차감`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right column: score history */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {selectedMember ? `${selectedMember.name}의 점수 내역` : '점수 내역'}
                  </CardTitle>
                  <CardDescription>
                    {selectedMember
                      ? `최근 50건 · 총점 ${totalScore >= 0 ? '+' : ''}${totalScore.toLocaleString()}점`
                      : '멤버를 선택하면 점수 내역이 표시됩니다.'}
                  </CardDescription>
                </div>
                {selectedMember && !historyLoading && (
                  <div className="flex items-center gap-1.5">
                    {totalScore >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-rose-500" />
                    )}
                    <span
                      className={cn(
                        'text-lg font-bold',
                        totalScore >= 0 ? 'text-emerald-600' : 'text-rose-500'
                      )}
                    >
                      {totalScore >= 0 ? '+' : ''}
                      {totalScore.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedMemberId ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Star className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    멤버를 선택하면
                    <br />
                    점수 내역이 표시됩니다.
                  </p>
                </div>
              ) : historyLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  불러오는 중...
                </div>
              ) : scoreRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Star className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">아직 점수 내역이 없습니다.</p>
                </div>
              ) : (
                <>
                  {/* Mobile card list */}
                  <div className="md:hidden space-y-3">
                    {scoreRecords.map((record) => (
                      <div key={record.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            className={cn(
                              'border text-xs font-medium',
                              getActivityTypeBadgeClass(record.type)
                            )}
                          >
                            {getActivityTypeLabel(record.type)}
                          </Badge>
                          <span
                            className={cn(
                              'text-sm font-bold shrink-0',
                              record.points >= 0 ? 'text-emerald-600' : 'text-rose-500'
                            )}
                          >
                            {record.points >= 0 ? '+' : ''}
                            {record.points.toLocaleString()}점
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{record.description}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{formatDate(record.date)}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingRecord(record)}
                            disabled={deleteLoading && deletingRecord?.id === record.id}
                          >
                            {deleteLoading && deletingRecord?.id === record.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">유형</TableHead>
                          <TableHead className="text-right whitespace-nowrap">점수</TableHead>
                          <TableHead>설명</TableHead>
                          <TableHead className="whitespace-nowrap">날짜</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scoreRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                className={cn(
                                  'border text-xs font-medium',
                                  getActivityTypeBadgeClass(record.type)
                                )}
                              >
                                {getActivityTypeLabel(record.type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <span
                                className={cn(
                                  'font-bold',
                                  record.points >= 0 ? 'text-emerald-600' : 'text-rose-500'
                                )}
                              >
                                {record.points >= 0 ? '+' : ''}
                                {record.points.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-foreground max-w-[240px] truncate">
                              {record.description}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {formatDate(record.date)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeletingRecord(record)}
                                disabled={deleteLoading && deletingRecord?.id === record.id}
                              >
                                {deleteLoading && deletingRecord?.id === record.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs"
            onClick={handleDeleteClose}
          />
          <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">점수 내역 삭제</h2>
                <p className="text-sm text-muted-foreground">
                  이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>

            <div className="mb-6 space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    'border text-xs font-medium',
                    getActivityTypeBadgeClass(deletingRecord.type)
                  )}
                >
                  {getActivityTypeLabel(deletingRecord.type)}
                </Badge>
                <span
                  className={cn(
                    'text-sm font-bold',
                    deletingRecord.points >= 0 ? 'text-emerald-600' : 'text-rose-500'
                  )}
                >
                  {deletingRecord.points >= 0 ? '+' : ''}
                  {deletingRecord.points.toLocaleString()}점
                </span>
              </div>
              <p className="text-sm text-foreground">{deletingRecord.description}</p>
              <p className="text-xs text-muted-foreground">{formatDate(deletingRecord.date)}</p>
            </div>

            {deleteError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleDeleteClose}>
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading ? '삭제 중...' : '삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
