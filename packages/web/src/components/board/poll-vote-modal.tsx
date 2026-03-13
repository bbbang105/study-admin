'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import type { Poll } from './poll-display';

interface PollVoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poll: Poll;
  onVote: (optionIds: string[]) => void;
}

export function PollVoteModal({
  open,
  onOpenChange,
  poll,
  onVote,
}: PollVoteModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isMultiple = poll.pollType === 'multiple';

  const handleOptionClick = (optionId: string) => {
    if (isMultiple) {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0) return;

    setSubmitting(true);
    await onVote(selectedOptions);
    setSelectedOptions([]);
    setSubmitting(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedOptions([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">투표하기</DialogTitle>
          <DialogDescription className="text-base">
            {poll.question}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {poll.options.map((option) => {
            const isSelected = selectedOptions.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleOptionClick(option.id)}
                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/5 ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60'
                }`}
              >
                {isMultiple ? (
                  <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input'
                  }`}>
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </div>
                ) : (
                  <div className={`h-5 w-5 rounded-full border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-input'
                  }`}>
                    {isSelected && (
                      <div className="flex h-full items-center justify-center">
                        <Circle className="h-2.5 w-2.5 fill-primary-foreground text-primary-foreground" />
                      </div>
                    )}
                  </div>
                )}
                <span className="flex-1 font-normal">{option.optionText}</span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleVote}
            disabled={selectedOptions.length === 0 || submitting}
            className="bg-sky-500 text-white hover:bg-sky-600 min-w-[100px]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                투표 중...
              </>
            ) : (
              '투표하기'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
