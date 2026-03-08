'use client';

import { useRef } from 'react';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { RefreshCw } from 'lucide-react';

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setIndicatorRef, setIconRef } = usePullToRefresh(containerRef);

  return (
    <>
      {/* Indicator - positioned above the content, revealed by translateY */}
      <div
        ref={setIndicatorRef}
        className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{
          top: `calc(env(safe-area-inset-top) + 3.5rem - 48px)`,
          opacity: 0,
        }}
      >
        <div
          data-circle
          className="flex items-center justify-center h-9 w-9 rounded-full bg-background shadow-md border border-border"
        >
          <div ref={setIconRef} className="h-4 w-4 text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Content wrapper that translates down */}
      <div ref={containerRef} className="will-change-transform">
        {children}
      </div>
    </>
  );
}
