'use client';

import { useState } from 'react';
import { BarChart3, Clock, Users, Lock, Check } from 'lucide-react';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Button } from '@/components/ui/button';
import { PollVoteModal } from './poll-vote-modal';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PollOption {
  id: string;
  optionText: string;
  voteCount: number;
  percentage: number;
  voted: boolean;
  voters: Array<{
    memberId: string;
    name: string;
    nickname: string;
    profileImage: string | null;
    discordId: string;
    votedAt: string;
  }>;
}

export interface Poll {
  id: string;
  question: string;
  pollType: 'single' | 'multiple' | 'date' | 'anonymous';
  expiresAt: string;
  allowAddOption: boolean;
  isExpired: boolean;
  hasVoted: boolean;
  totalVotes: number;
  options: PollOption[];
}

interface PollDisplayProps {
  postId: string;
  poll: Poll;
  onRefresh: () => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDateString(dateStr: string): string {
  // Check if it's a date string (YYYY-MM-DD format)
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[date.getDay()];
    return `${dateMatch[2]}/${dateMatch[3]} (${dayOfWeek})`;
  }
  return dateStr;
}

function formatExpiresAt(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) return '마감됨';
  if (diffHours < 1) return '1시간 이내 마감';
  if (diffHours < 24) return `${diffHours}시간 후 마감`;
  if (diffDays < 7) return `${diffDays}일 후 마감`;
  return date.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPollTypeLabel(pollType: string): string {
  const labels = {
    single: '단일 선택',
    multiple: '복수 선택',
    date: '날짜 투표',
    anonymous: '익명 투표',
  };
  return labels[pollType as keyof typeof labels] || pollType;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function PollDisplay({ postId, poll, onRefresh }: PollDisplayProps) {
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [voting, setVoting] = useState(false);
  const [votersModalOpen, setVotersModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<PollOption | null>(null);

  const handleVote = async (optionIds: string[]) => {
    if (voting) return; // Prevent double submission

    setVoting(true);
    try {
      const res = await fetch(
        `/api/board/${postId}/polls/${poll.id}/vote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionIds }),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || result.error?.message || '투표에 실패했습니다.');
        return;
      }

      toast.success(result.message || '투표가 완료되었습니다.');
      onRefresh();
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setVoting(false);
      setVoteModalOpen(false);
    }
  };

  const canVote = !poll.isExpired;

  const handleShowVoters = (option: PollOption) => {
    setSelectedOption(option);
    setVotersModalOpen(true);
  };

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <BarChart3 className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold leading-tight">{poll.question}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatExpiresAt(poll.expiresAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {poll.totalVotes}명 참여
                </span>
                {poll.pollType === 'anonymous' && (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    익명
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
              {getPollTypeLabel(poll.pollType)}
            </span>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {poll.options.map((option) => (
            <div
              key={option.id}
              className={`relative overflow-hidden rounded-lg border p-3 transition-colors ${
                option.voted
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border/60 bg-muted/20'
              }`}
            >
              {/* Progress bar background */}
              {option.percentage > 0 && (
                <div
                  className="absolute inset-0 bg-primary/5 transition-all"
                  style={{ width: `${option.percentage}%` }}
                />
              )}

              {/* Content */}
              <div className="relative">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {option.voted && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="font-medium text-sm">
                      {poll.pollType === 'date' ? formatDateString(option.optionText) : option.optionText}
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {option.voteCount}표 ({option.percentage}%)
                  </span>
                </div>

                {/* Progress bar */}
                {option.percentage > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                )}

                {/* Voters (non-anonymous only) */}
                {poll.pollType !== 'anonymous' && option.voters.length > 0 && (
                  <div className="flex items-center justify-between gap-2 mt-2.5">
                    <div className="flex flex-wrap gap-2">
                      {option.voters.slice(0, 5).map((voter) => (
                        <div
                          key={voter.memberId}
                          className="flex items-center gap-1.5 rounded-full bg-muted/50 pl-0.5 pr-2 py-0.5"
                          title={`${voter.name} (${voter.nickname || '닉네임 없음'})`}
                        >
                          <MemberAvatar
                            memberId={voter.memberId}
                            name={voter.name}
                            seed={voter.discordId || voter.name}
                            imageUrl={voter.profileImage}
                            size="sm"
                          />
                          <span className="text-xs text-muted-foreground">
                            {voter.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30"
                      onClick={() => handleShowVoters(option)}
                    >
                      상세보기 {option.voters.length}명
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action button */}
        {canVote && (
          <Button
            onClick={() => setVoteModalOpen(true)}
            disabled={voting}
            className="w-full bg-sky-500 text-white hover:bg-sky-600"
          >
            {voting ? '투표 중...' : poll.hasVoted ? '투표 변경' : '투표하기'}
          </Button>
        )}

        {poll.isExpired && !poll.hasVoted && (
          <div className="text-center text-sm text-muted-foreground py-2">
            마감된 투표입니다
          </div>
        )}
      </div>

      {/* Vote modal */}
      <PollVoteModal
        open={voteModalOpen}
        onOpenChange={setVoteModalOpen}
        poll={poll}
        onVote={handleVote}
      />

      {/* Voters modal */}
      <Dialog open={votersModalOpen} onOpenChange={setVotersModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center justify-between">
              <span>투표자 목록</span>
              <span className="text-sm font-normal text-muted-foreground">
                {selectedOption?.optionText}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {selectedOption?.voters.map((voter) => (
              <Link
                key={voter.memberId}
                href={`/members/${voter.memberId}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                onClick={() => setVotersModalOpen(false)}
              >
                <MemberAvatar
                  memberId={voter.memberId}
                  name={voter.name}
                  seed={voter.discordId || voter.name}
                  imageUrl={voter.profileImage}
                  size="md"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{voter.name}</div>
                  {voter.nickname && voter.nickname !== voter.name && (
                    <div className="text-xs text-muted-foreground">@{voter.nickname}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(voter.votedAt).toLocaleString('ko-KR', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVotersModalOpen(false)}
            >
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
