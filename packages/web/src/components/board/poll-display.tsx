'use client';

import { useState } from 'react';
import { BarChart3, Check, Clock, Lock, Send, Users, UserX } from 'lucide-react';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Button } from '@/components/ui/button';
import { PollVoteModal } from './poll-vote-modal';
import { CancelVoteDialog } from './cancel-vote-dialog';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Link from 'next/link';
import { formatExpiresAt, formatPollDate } from '@/lib/date-utils';

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

export interface NonVoter {
  memberId: string;
  name: string;
  nickname: string;
  profileImage: string | null;
  discordId: string;
}

export interface Poll {
  id: string;
  question: string;
  pollType: 'text' | 'date';
  expiresAt: string;
  allowMultiple: boolean;
  isAnonymous: boolean;
  isExpired: boolean;
  hasVoted: boolean;
  totalVotes: number;
  totalEligibleMembers: number;
  nonVoters: NonVoter[];
  options: PollOption[];
}

interface PollDisplayProps {
  postId: string;
  poll: Poll;
  onRefresh: () => void;
  isAdmin?: boolean;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getPollTypeLabel(poll: Poll): string {
  const labels = {
    text: '텍스트',
    date: '날짜',
  };
  const typeLabel = labels[poll.pollType] || poll.pollType;

  const options = [];
  if (poll.allowMultiple) options.push('복수');
  if (poll.isAnonymous) options.push('익명');

  const optionText = options.length > 0 ? ` · ${options.join(', ')}` : '';
  return typeLabel + optionText;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function PollDisplay({ postId, poll, onRefresh, isAdmin }: PollDisplayProps) {
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [voting, setVoting] = useState(false);
  const [votersModalOpen, setVotersModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<PollOption | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [participantsTab, setParticipantsTab] = useState<'voted' | 'notVoted'>('voted');
  const [sendingDM, setSendingDM] = useState(false);
  const [sendingIndividual, setSendingIndividual] = useState<string | null>(null);

  const handleVote = async (optionIds: string[]) => {
    if (voting) return; // Prevent double submission

    setVoting(true);

    // Optimistic: Immediately refresh to show latest data from server
    // This bypasses browser cache with timestamp
    onRefresh();

    try {
      const res = await fetch(`/api/board/${postId}/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIds }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || result.error?.message || '투표에 실패했습니다.');
        // Refresh again to revert optimistic update
        onRefresh();
        return;
      }

      toast.success(result.message || '투표가 완료되었습니다.');
      // Final refresh to ensure data is synced
      onRefresh();
    } catch {
      toast.error('서버 오류가 발생했습니다.');
      // Refresh again to revert optimistic update
      onRefresh();
    } finally {
      setVoting(false);
      setVoteModalOpen(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (voting) return;

    setVoting(true);
    onRefresh();

    try {
      const res = await fetch(`/api/board/${postId}/polls/${poll.id}/vote`, {
        method: 'DELETE',
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || result.error?.message || '투표 취소에 실패했습니다.');
        onRefresh();
        throw new Error('Cancel vote failed');
      }

      toast.success(result.message || '투표가 취소되었습니다.');
      onRefresh();
    } catch {
      // Error is handled in the dialog
      throw new Error('Cancel vote failed');
    } finally {
      setVoting(false);
    }
  };

  const canVote = !poll.isExpired;
  const showResults = poll.hasVoted || poll.isExpired;

  // Unique voters across all options (for participants modal)
  const allVoters = (() => {
    const seen = new Set<string>();
    const voters: PollOption['voters'] = [];
    for (const opt of poll.options) {
      for (const v of opt.voters) {
        if (!seen.has(v.memberId)) {
          seen.add(v.memberId);
          voters.push(v);
        }
      }
    }
    return voters;
  })();

  const handleSendReminderDM = async (discordId?: string) => {
    if (sendingDM || sendingIndividual) return;

    if (discordId) {
      setSendingIndividual(discordId);
    } else {
      setSendingDM(true);
    }

    try {
      const res = await fetch('/api/admin/poll-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId: poll.id, ...(discordId && { discordId }) }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error?.message || 'DM 발송에 실패했습니다.');
        return;
      }
      const data = result.data?.result;
      if (discordId) {
        toast.success('DM을 발송했습니다.');
      } else {
        toast.success(`미참여자 ${data?.dmsSent ?? 0}명에게 DM을 발송했습니다.`);
      }
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setSendingDM(false);
      setSendingIndividual(null);
    }
  };

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
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatExpiresAt(poll.expiresAt)}
                </span>
                {showResults && (
                  <>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-sky-500 transition-colors"
                      onClick={() => {
                        setParticipantsTab('voted');
                        setParticipantsModalOpen(true);
                      }}
                    >
                      <Users className="h-3 w-3" />
                      {poll.totalVotes}명 참여
                    </button>
                    {!poll.isAnonymous && isAdmin && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-orange-500 transition-colors"
                        onClick={() => {
                          setParticipantsTab('notVoted');
                          setParticipantsModalOpen(true);
                        }}
                      >
                        <UserX className="h-3 w-3" />
                        {poll.totalEligibleMembers - poll.totalVotes}명 미참여
                      </button>
                    )}
                  </>
                )}
                {poll.isAnonymous && (
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
              {getPollTypeLabel(poll)}
            </span>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {poll.options.map((option) => (
            <div
              key={option.id}
              className={`relative overflow-hidden rounded-lg border p-3 transition-colors ${
                option.voted ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-muted/20'
              }`}
            >
              {/* Progress bar background */}
              {showResults && option.percentage > 0 && (
                <div
                  className="absolute inset-0 bg-primary/5 transition-all"
                  style={{ width: `${option.percentage}%` }}
                />
              )}

              {/* Content */}
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {option.voted && <Check className="h-4 w-4 text-primary shrink-0" />}
                    <span className="font-medium text-sm">
                      {poll.pollType === 'date'
                        ? formatPollDate(option.optionText)
                        : option.optionText}
                    </span>
                  </div>
                  {showResults && (
                    <span className="text-sm font-semibold tabular-nums">
                      {option.voteCount}표 ({option.percentage}%)
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {showResults && option.percentage > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-border overflow-hidden mt-2">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                )}

                {/* Voters (non-anonymous only) */}
                {showResults && !poll.isAnonymous && option.voters.length > 0 && (
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
                          <span className="text-xs text-muted-foreground">{voter.name}</span>
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
          <div className="flex gap-2">
            {poll.hasVoted && (
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(true)}
                disabled={voting}
                className="flex-1"
              >
                {voting ? '취소 중...' : '투표 취소'}
              </Button>
            )}
            <Button
              onClick={() => setVoteModalOpen(true)}
              disabled={voting}
              className={poll.hasVoted ? 'flex-1' : 'w-full bg-sky-500 text-white hover:bg-sky-600'}
            >
              {voting ? '투표 중...' : poll.hasVoted ? '투표 변경' : '투표하기'}
            </Button>
          </div>
        )}

        {!showResults && canVote && (
          <div className="text-center text-xs text-muted-foreground">
            투표 후 결과를 확인할 수 있습니다
          </div>
        )}

        {poll.isExpired && !poll.hasVoted && (
          <div className="text-center text-sm text-muted-foreground py-2">마감된 투표입니다</div>
        )}
      </div>

      {/* Vote modal */}
      <PollVoteModal
        open={voteModalOpen}
        onOpenChange={setVoteModalOpen}
        poll={poll}
        onVote={handleVote}
      />

      {/* Voters modal (per-option) */}
      <Dialog open={votersModalOpen} onOpenChange={setVotersModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pt-2">
            <DialogTitle className="text-base flex items-center justify-between pr-2">
              <span>투표자 목록</span>
              <span className="text-xs font-normal text-muted-foreground truncate max-w-[160px]">
                {selectedOption &&
                  (poll.pollType === 'date'
                    ? formatPollDate(selectedOption.optionText)
                    : selectedOption.optionText)}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto -mx-2">
            {selectedOption?.voters.map((voter) => (
              <Link
                key={voter.memberId}
                href={`/members/${voter.memberId}`}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                onClick={() => setVotersModalOpen(false)}
              >
                <MemberAvatar
                  memberId={voter.memberId}
                  name={voter.name}
                  seed={voter.discordId || voter.name}
                  imageUrl={voter.profileImage}
                  size="sm"
                  noLink
                />
                <span className="text-sm font-medium flex-1 truncate">{voter.name}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {new Date(voter.votedAt).toLocaleString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Participants modal (참여/미참여 탭) */}
      {!poll.isAnonymous && (
        <Dialog open={participantsModalOpen} onOpenChange={setParticipantsModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader className="pt-2">
              <DialogTitle className="text-base">투표 현황</DialogTitle>
            </DialogHeader>

            {/* Tabs */}
            {isAdmin ? (
              <div className="flex border-b border-border">
                <button
                  type="button"
                  className={`flex-1 pb-2 text-sm font-medium text-center transition-colors ${
                    participantsTab === 'voted'
                      ? 'text-sky-600 border-b-2 border-sky-500'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setParticipantsTab('voted')}
                >
                  <Users className="h-3.5 w-3.5 inline mr-1" />
                  참여 {poll.totalVotes}명
                </button>
                <button
                  type="button"
                  className={`flex-1 pb-2 text-sm font-medium text-center transition-colors ${
                    participantsTab === 'notVoted'
                      ? 'text-orange-600 border-b-2 border-orange-500'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setParticipantsTab('notVoted')}
                >
                  <UserX className="h-3.5 w-3.5 inline mr-1" />
                  미참여 {poll.totalEligibleMembers - poll.totalVotes}명
                </button>
              </div>
            ) : null}

            {/* List */}
            <div className="max-h-[50vh] overflow-y-auto -mx-2">
              {participantsTab === 'voted' ? (
                allVoters.length > 0 ? (
                  allVoters.map((voter) => (
                    <Link
                      key={voter.memberId}
                      href={`/members/${voter.memberId}`}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                      onClick={() => setParticipantsModalOpen(false)}
                    >
                      <MemberAvatar
                        memberId={voter.memberId}
                        name={voter.name}
                        seed={voter.discordId || voter.name}
                        imageUrl={voter.profileImage}
                        size="sm"
                        noLink
                      />
                      <span className="text-sm font-medium flex-1 truncate">{voter.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {new Date(voter.votedAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    아직 참여자가 없습니다
                  </p>
                )
              ) : (
                <>
                  {poll.nonVoters.length > 0 ? (
                    poll.nonVoters.map((member) => (
                      <div
                        key={member.memberId}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <Link
                          href={`/members/${member.memberId}`}
                          className="flex items-center gap-2.5 flex-1 min-w-0"
                          onClick={() => setParticipantsModalOpen(false)}
                        >
                          <MemberAvatar
                            memberId={member.memberId}
                            name={member.name}
                            seed={member.discordId || member.name}
                            imageUrl={member.profileImage}
                            size="sm"
                            noLink
                          />
                          <span className="text-sm font-medium flex-1 truncate">{member.name}</span>
                        </Link>
                        {isAdmin && !poll.isExpired && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 shrink-0 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30"
                            onClick={() => handleSendReminderDM(member.discordId)}
                            disabled={sendingDM || sendingIndividual === member.discordId}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      전원 참여했습니다
                    </p>
                  )}

                  {/* 관리자 전용: 전체 DM 발송 (마감 전만) */}
                  {isAdmin && !poll.isExpired && poll.nonVoters.length > 0 && (
                    <div className="px-2 pt-3 mt-2 border-t border-border">
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleSendReminderDM()}
                        disabled={sendingDM || !!sendingIndividual}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sendingDM
                          ? 'DM 발송 중...'
                          : `전체 ${poll.nonVoters.length}명에게 DM 발송`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel vote dialog */}
      <CancelVoteDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleConfirmCancel}
      />
    </>
  );
}
