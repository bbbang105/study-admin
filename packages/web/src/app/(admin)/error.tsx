'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-4">
      <AlertCircle className="h-10 w-10 text-destructive/60" />
      <div className="text-center space-y-1">
        <h2 className="text-base font-semibold">관리자 페이지 오류</h2>
        <p className="text-sm text-muted-foreground">잠시 후 다시 시도해주세요.</p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        다시 시도
      </button>
    </div>
  );
}
