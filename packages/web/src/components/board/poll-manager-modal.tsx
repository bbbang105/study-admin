'use client';

import { useEffect, useState } from 'react';
import { Trash2, Edit2, Users, Lock, AlertCircle, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PollType = 'single' | 'multiple' | 'date' | 'anonymous';

export interface Poll {
  id: string;
  question: string;
  pollType: PollType;
  expiresAt: string;
  totalVotes: number;
  options: Array<{
    id: string;
    optionText: string;
    voteCount: number;
  }>;
}

interface PollManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  initialPolls: Poll[];
  onPollsUpdate: (polls: Poll[]) => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const POLL_TYPE_OPTIONS = [
  { value: 'single' as const, label: '단일 선택' },
  { value: 'multiple' as const, label: '복수 선택' },
  { value: 'date' as const, label: '날짜 투표' },
  { value: 'anonymous' as const, label: '익명 투표' },
];

const EXPIRY_OPTIONS = [
  { label: '1시간', hours: 1 },
  { label: '6시간', hours: 6 },
  { label: '1일', hours: 24 },
  { label: '3일', hours: 72 },
  { label: '1주', hours: 168 },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function PollManagerModal({
  open,
  onOpenChange,
  postId,
  initialPolls,
  onPollsUpdate,
}: PollManagerModalProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Load polls when modal opens
  useEffect(() => {
    if (open) {
      setPolls(initialPolls);
    }
  }, [open, initialPolls]);

  // Check if poll can be edited (no votes)
  const canEditPoll = (poll: Poll) => poll.totalVotes === 0;

  const handleDeletePoll = async (pollId: string) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) return;

    if (!canEditPoll(poll)) {
      toast.error('투표 참여자가 있어 수정할 수 없습니다.');
      return;
    }

    if (!confirm(`"${poll.question}" 투표를 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/board/${postId}/polls/${pollId}`, {
        method: 'DELETE',
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || result.error?.message || '투표 삭제에 실패했습니다.');
        return;
      }

      toast.success('투표가 삭제되었습니다.');
      const updated = polls.filter((p) => p.id !== pollId);
      setPolls(updated);
      onPollsUpdate(updated);
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePoll = async (pollId: string) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll || !editingPoll) return;

    if (!canEditPoll(poll)) {
      toast.error('투표 참여자가 있어 수정할 수 없습니다.');
      return;
    }

    // Validation
    if (!editingPoll.question?.trim()) {
      toast.error('질문을 입력해주세요.');
      return;
    }

    const validOptions = editingPoll.options?.filter((opt) => opt.optionText.trim()) || [];
    if (validOptions.length < 2) {
      toast.error('선택지는 최소 2개 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/board/${postId}/polls/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: editingPoll.question.trim(),
          pollType: editingPoll.pollType,
          expiresAt: editingPoll.expiresAt,
          options: validOptions.map((opt, idx) => ({
            id: opt.id,
            optionText: opt.optionText.trim(),
            optionOrder: idx,
          })),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || result.error?.message || '투표 수정에 실패했습니다.');
        return;
      }

      toast.success('투표가 수정되었습니다.');

      // Update local state
      const updated = polls.map((p) =>
        p.id === pollId ? { ...p, ...editingPoll } : p
      );
      setPolls(updated);
      onPollsUpdate(updated);
      setEditingPoll(null);
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">투표 관리</DialogTitle>
          <DialogDescription>
            투표를 수정하거나 삭제할 수 있습니다. 투표 참여자가 있으면 수정할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {polls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              현재 등록된 투표가 없습니다.
            </div>
          ) : (
            polls.map((poll) => (
              <div
                key={poll.id}
                className="border border-border/60 rounded-lg p-4 space-y-3"
              >
                {/* Poll header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{poll.question}</h4>
                      <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                        {POLL_TYPE_OPTIONS.find((t) => t.value === poll.pollType)?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {poll.totalVotes}명 참여
                      </span>
                      {poll.totalVotes > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Lock className="h-3 w-3" />
                          수정 불가
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canEditPoll(poll) && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPoll(poll)}
                        className="h-8 px-2 text-xs"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePoll(poll.id)}
                        className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                        disabled={loading}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Editing form */}
                {editingPoll?.id === poll.id && (
                  <div className="space-y-3 border-t border-border/40 pt-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">질문</Label>
                      <Input
                        value={editingPoll.question}
                        onChange={(e) =>
                          setEditingPoll({ ...editingPoll, question: e.target.value })
                        }
                        placeholder="투표 질문"
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">투표 유형</Label>
                      <Select
                        value={editingPoll.pollType}
                        onValueChange={(value: PollType) =>
                          setEditingPoll({ ...editingPoll, pollType: value })
                        }
                      >
                        <SelectTrigger className="w-full sm:w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {POLL_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">선택지 (최소 2개)</Label>
                      <div className="space-y-2">
                        {editingPoll.options.map((option, idx) => (
                          <div key={option.id} className="flex gap-2">
                            <Input
                              value={option.optionText}
                              onChange={(e) => {
                                const newOptions = [...editingPoll.options];
                                newOptions[idx] = { ...newOptions[idx], optionText: e.target.value };
                                setEditingPoll({ ...editingPoll, options: newOptions });
                              }}
                              placeholder={`선택지 ${idx + 1}`}
                              className="flex-1 text-sm"
                            />
                            {editingPoll.options.length > 2 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newOptions = editingPoll.options.filter((_, i) => i !== idx);
                                  setEditingPoll({ ...editingPoll, options: newOptions });
                                }}
                                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingPoll({
                              ...editingPoll,
                              options: [
                                ...editingPoll.options,
                                { id: crypto.randomUUID(), optionText: '', voteCount: 0 },
                              ],
                            });
                          }}
                          className="w-full text-xs"
                        >
                          + 선택지 추가
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">마감시간</Label>
                      <div className="space-y-2">
                        {/* Date picker */}
                        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {editingPoll.expiresAt
                                ? format(new Date(editingPoll.expiresAt), 'yyyy년 MM월 dd일', { locale: ko })
                                : '날짜 선택'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={editingPoll.expiresAt ? new Date(editingPoll.expiresAt) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  const currentExpiresAt = new Date(editingPoll.expiresAt);
                                  date.setHours(currentExpiresAt.getHours(), currentExpiresAt.getMinutes());
                                  setEditingPoll({
                                    ...editingPoll,
                                    expiresAt: date.toISOString(),
                                  });
                                }
                                setCalendarOpen(false);
                              }}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        {/* Time picker */}
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="time"
                            value={
                              editingPoll.expiresAt
                                ? format(new Date(editingPoll.expiresAt), 'HH:mm')
                                : ''
                            }
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(':').map(Number);
                              const date = new Date(editingPoll.expiresAt);
                              date.setHours(hours || 0, minutes || 0);
                              setEditingPoll({
                                ...editingPoll,
                                expiresAt: date.toISOString(),
                              });
                            }}
                            className="flex-1"
                          />
                        </div>

                        {/* Quick extend buttons */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {EXPIRY_OPTIONS.map((option) => (
                            <Button
                              key={option.hours}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newExpiresAt = new Date(
                                  new Date(editingPoll.expiresAt).getTime() +
                                    option.hours * 60 * 60 * 1000
                                ).toISOString();
                                setEditingPoll({
                                  ...editingPoll,
                                  expiresAt: newExpiresAt,
                                });
                              }}
                              className="h-7 text-xs"
                            >
                              +{option.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPoll(null)}
                      >
                        취소
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdatePoll(poll.id)}
                        disabled={loading}
                        className="bg-sky-500 text-white hover:bg-sky-600"
                      >
                        {loading ? '저장 중...' : '저장'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Options preview (read-only) */}
                {editingPoll?.id !== poll.id && (
                  <div className="space-y-1.5">
                    {poll.options.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center justify-between rounded border border-border/60 px-3 py-1.5"
                      >
                        <span className="text-sm">{option.optionText}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.voteCount}표
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
