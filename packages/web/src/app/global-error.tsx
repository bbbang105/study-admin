'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily:
            '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          backgroundColor: 'var(--bg, #fff)',
          color: 'var(--fg, #111)',
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root { --bg: #fff; --fg: #111; --muted: #666; --border: #ddd; --hover-bg: #f5f5f5; }
              @media (prefers-color-scheme: dark) {
                :root { --bg: #0a0a0a; --fg: #ededed; --muted: #999; --border: #333; --hover-bg: #1a1a1a; }
              }
              .reset-btn:hover { background-color: var(--hover-bg); }
              .reset-btn:focus-visible { outline: 2px solid #0091ff; outline-offset: 2px; }
            `,
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
            gap: '1rem',
          }}
        >
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
            오류가 발생했습니다
          </h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.875rem' }}>
            문제가 지속되면 관리자에게 문의해주세요.
          </p>
          <button
            className="reset-btn"
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--fg)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
