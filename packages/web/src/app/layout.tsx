import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import './globals.css';

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: '큐스팅 4th',
    template: '%s | 큐스팅 4th',
  },
  description: '큐스팅 4th · 블로그 스터디 자동화 플랫폼',
  manifest: '/manifest.json',
  openGraph: {
    title: '큐스팅 4th',
    description: '함께 쓰고, 함께 성장하다. 블로그 스터디 자동화 플랫폼',
    siteName: '큐스팅 4th',
    url: 'https://kusting.com',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '큐스팅 4th',
    description: '함께 쓰고, 함께 성장하다. 블로그 스터디 자동화 플랫폼',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '큐스팅 4th',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className="font-sans antialiased"
        style={{
          fontFamily:
            '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", sans-serif',
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              className: 'font-sans',
              style: {
                fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
              },
            }}
            richColors
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
