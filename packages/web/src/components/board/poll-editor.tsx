'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, BarChart3, Calendar, Clock, Edit2, Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PollType = 'text' | 'date';

export interface Poll {
  question: string;
  pollType: PollType;
  expiresAt: string; // ISO 8601
  allowMultiple: boolean;
  isAnonymous: boolean;
  options: string[];
}

interface PollEditorProps {
  polls: Poll[];
  onPollsChange: (polls: Poll[]) => void;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const POLL_TYPE_OPTIONS = [
  { value: 'text' as const, label: '텍스트 투표' },
  { value: 'date' as const, label: '날짜 투표' },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function PollEditor({ polls, onPollsChange }: PollEditorProps) {
  const [newPoll, setNewPoll] = useState<Partial<Poll>>(() => ({
    pollType: 'text',
    allowMultiple: false,
    isAnonymous: false,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }));
  const [options, setOptions] = useState<string[]>(['', '']);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateOptions, setDateOptions] = useState<Date[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddPoll = () => {
    // Check if poll already exists
    if (polls.length >= 1) {
      toast.error('게시글당 투표는 1개만 생성할 수 있습니다.');
      return;
    }

    // Validation
    if (!newPoll.question?.trim()) {
      toast.error('질문을 입력해주세요.');
      return;
    }

    if (!newPoll.pollType) {
      toast.error('투표 유형을 선택해주세요.');
      return;
    }

    // For date polls, use selected dates as options
    let finalOptions: string[];
    if (newPoll.pollType === 'date') {
      if (dateOptions.length < 2) {
        toast.error('날짜는 최소 2개 이상 선택해야 합니다.');
        return;
      }
      // Format dates as strings
      finalOptions = dateOptions
        .sort((a, b) => a.getTime() - b.getTime())
        .map(date => format(date, 'yyyy-MM-dd'));
    } else {
      const validOptions = options.filter((opt) => opt.trim());
      if (validOptions.length < 2) {
        toast.error('선택지는 최소 2개 이상이어야 합니다.');
        return;
      }
      finalOptions = validOptions;
    }

    if (!newPoll.expiresAt) {
      toast.error('마감시간을 설정해주세요.');
      return;
    }

    // Add poll
    const poll: Poll = {
      question: newPoll.question.trim(),
      pollType: newPoll.pollType,
      allowMultiple: newPoll.allowMultiple || false,
      isAnonymous: newPoll.isAnonymous || false,
      expiresAt: newPoll.expiresAt,
      options: finalOptions,
    };

    onPollsChange([...polls, poll]);

    // Reset form
    setNewPoll({
      pollType: 'text',
      allowMultiple: false,
      isAnonymous: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    setOptions(['', '']);
    setDateOptions([]);
  };

  const handleRemovePoll = (index: number) => {
    onPollsChange(polls.filter((_, i) => i !== index));
  };

  const handleEditPoll = (index: number) => {
    const poll = polls[index];
    if (!poll) return;

    setNewPoll({
      question: poll.question,
      pollType: poll.pollType,
      allowMultiple: poll.allowMultiple,
      isAnonymous: poll.isAnonymous,
      expiresAt: poll.expiresAt,
    });

    // Set options based on poll type
    if (poll.pollType === 'date') {
      setDateOptions(poll.options.map(dateStr => {
        const parts = dateStr.split('-').map(Number);
        const [year, month, day] = parts;
        if (!year || !month || !day) return new Date();
        return new Date(year, month - 1, day);
      }));
    } else {
      setOptions(poll.options);
    }

    setEditingIndex(index);
  };

  const handleUpdatePoll = () => {
    if (editingIndex === null) return;

    // Validation
    if (!newPoll.question?.trim()) {
      toast.error('질문을 입력해주세요.');
      return;
    }

    if (!newPoll.pollType) {
      toast.error('투표 유형을 선택해주세요.');
      return;
    }

    // For date polls, use selected dates as options
    let finalOptions: string[];
    if (newPoll.pollType === 'date') {
      if (dateOptions.length < 2) {
        toast.error('날짜는 최소 2개 이상 선택해야 합니다.');
        return;
      }
      finalOptions = dateOptions
        .sort((a, b) => a.getTime() - b.getTime())
        .map(date => format(date, 'yyyy-MM-dd'));
    } else {
      const validOptions = options.filter((opt) => opt.trim());
      if (validOptions.length < 2) {
        toast.error('선택지는 최소 2개 이상이어야 합니다.');
        return;
      }
      finalOptions = validOptions;
    }

    if (!newPoll.expiresAt) {
      toast.error('마감시간을 설정해주세요.');
      return;
    }

    // Update poll
    const updatedPolls = [...polls];
    updatedPolls[editingIndex] = {
      question: newPoll.question.trim(),
      pollType: newPoll.pollType,
      allowMultiple: newPoll.allowMultiple || false,
      isAnonymous: newPoll.isAnonymous || false,
      expiresAt: newPoll.expiresAt,
      options: finalOptions,
    };
    onPollsChange(updatedPolls);

    // Reset form
    setNewPoll({
      pollType: 'text',
      allowMultiple: false,
      isAnonymous: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    setOptions(['', '']);
    setDateOptions([]);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setNewPoll({
      pollType: 'text',
      allowMultiple: false,
      isAnonymous: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    setOptions(['', '']);
    setDateOptions([]);
    setEditingIndex(null);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast.error('선택지는 최소 2개 이상이어야 합니다.');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Existing polls */}
      {polls.length > 0 && editingIndex === null && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">투표</Label>
          {polls.map((poll, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{poll.question}</span>
                <span className="text-xs text-muted-foreground">
                  ({POLL_TYPE_OPTIONS.find((p) => p.value === poll.pollType)?.label})
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditPoll(index)}
                  className="h-7 px-2 text-xs"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePoll(index)}
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New poll form - show if no poll exists OR editing */}
      {(polls.length === 0 || editingIndex !== null) && (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {editingIndex !== null ? '투표 수정' : '새 투표 만들기'}
            </Label>
          </div>

          {/* Question */}
          <div className="space-y-1.5">
            <Label htmlFor="poll-question" className="text-sm font-medium">
              투표 질문
            </Label>
            <Input
              id="poll-question"
              placeholder="예: 이번 주말에 맛집갈 사람?"
              value={newPoll.question || ''}
              onChange={(e) => setNewPoll({ ...newPoll, question: e.target.value })}
              className="text-sm"
            />
          </div>

          {/* Poll type */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">투표 유형</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={newPoll.pollType === 'text' ? 'default' : 'outline'}
                onClick={() => setNewPoll({ ...newPoll, pollType: 'text' })}
                className="flex-1"
              >
                텍스트 투표
              </Button>
              <Button
                type="button"
                variant={newPoll.pollType === 'date' ? 'default' : 'outline'}
                onClick={() => setNewPoll({ ...newPoll, pollType: 'date' })}
                className="flex-1"
              >
                날짜 투표
              </Button>
            </div>
          </div>

          {/* Poll options */}
          <div className="space-y-3">
            <Label className="text-xs font-medium">투표 옵션</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={newPoll.allowMultiple ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNewPoll({ ...newPoll, allowMultiple: !newPoll.allowMultiple })}
                className="h-8 px-3 text-xs"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                복수 선택
              </Button>
              <Button
                type="button"
                variant={newPoll.isAnonymous ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNewPoll({ ...newPoll, isAnonymous: !newPoll.isAnonymous })}
                className="h-8 px-3 text-xs"
              >
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                익명
              </Button>
            </div>
          </div>

          {/* Expiry */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">마감시간</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {newPoll.expiresAt
                    ? format(new Date(newPoll.expiresAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })
                    : '마감 시간 설정'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="start">
                <div className="space-y-4">
                  {/* Date picker */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2">날짜</Label>
                    <CalendarComponent
                      mode="single"
                      selected={newPoll.expiresAt ? new Date(newPoll.expiresAt) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          // Preserve the time from current expiresAt
                          const currentExpiresAt = newPoll.expiresAt
                            ? new Date(newPoll.expiresAt)
                            : new Date();
                          date.setHours(currentExpiresAt.getHours(), currentExpiresAt.getMinutes());
                          setNewPoll({
                            ...newPoll,
                            expiresAt: date.toISOString(),
                          });
                        }
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="rounded-md border"
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: "text-sm font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
                        day_range_end: "day-range-end",
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                        day_outside: "day-outside text-muted-foreground opacity-50",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                    />
                  </div>

                  {/* Time picker */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2">시간</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={
                          newPoll.expiresAt
                            ? format(new Date(newPoll.expiresAt), 'HH:mm')
                            : ''
                        }
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          if (newPoll.expiresAt) {
                            const date = new Date(newPoll.expiresAt);
                            date.setHours(hours || 0, minutes || 0);
                            setNewPoll({
                              ...newPoll,
                              expiresAt: date.toISOString(),
                            });
                          }
                        }}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Options or Date Picker */}
          {newPoll.pollType === 'date' ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                날짜 선택 (최소 2개)
              </Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateOptions.length > 0
                      ? `${dateOptions.length}개 날짜 선택됨`
                      : '날짜 선택'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3">
                    <CalendarComponent
                      mode="multiple"
                      selected={dateOptions}
                      onSelect={(dates) => {
                        if (dates) {
                          setDateOptions(dates as Date[]);
                        }
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="rounded-md border"
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: "text-sm font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
                        day_range_end: "day-range-end",
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                        day_outside: "day-outside text-muted-foreground opacity-50",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              {/* Selected dates */}
              {dateOptions.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
                  {dateOptions
                    .sort((a, b) => a.getTime() - b.getTime())
                    .map((date, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 px-2 py-1 bg-background border rounded-md text-sm"
                      >
                        <span>{format(date, 'MM월 dd일 (E)', { locale: ko })}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setDateOptions(dateOptions.filter((_, i) => i !== index));
                          }}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                선택지 (최소 2개)
              </Label>
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`선택지 ${index + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(index)}
                    disabled={options.length <= 2}
                    className="h-9 w-9 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                선택지 추가
              </Button>
            </div>
          )}

          {/* Add/Update poll button */}
          <div className="flex gap-2">
            {editingIndex !== null && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                className="flex-1"
              >
                취소
              </Button>
            )}
            <Button
              type="button"
              onClick={editingIndex !== null ? handleUpdatePoll : handleAddPoll}
              className="flex-1 bg-sky-500 text-white hover:bg-sky-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              {editingIndex !== null ? '저장' : '투표 추가'}
            </Button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
