import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, Banknote, CalendarCheck, Newspaper, Rss, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const features = [
  {
    icon: Rss,
    title: 'RSS 자동 수집',
    description: '블로그 글 발행 시 자동 감지 및 수집',
  },
  {
    icon: Activity,
    title: '활동 점수 & 랭킹',
    description: '글 작성·댓글·출석 등 활동 기반 점수 시스템',
  },
  {
    icon: CalendarCheck,
    title: '출석 자동화',
    description: '2주 1회차, 지각·결석 자동 판정',
  },
  {
    icon: Banknote,
    title: '벌금 관리',
    description: '자동 부과, DM 알림, 납부 확인',
  },
  {
    icon: Trophy,
    title: '랭킹 & 통계',
    description: '포스트 수, 출석률 기반 실시간 랭킹',
  },
  {
    icon: Newspaper,
    title: '큐레이션',
    description: '관심 키워드 기반 컨퍼런스·아티클 추천',
  },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ------------------------------------------------------------------ */}
      {/* Nav                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-primary">BS</span>
            <span className="text-sm font-medium text-foreground/80">블로그 스터디</span>
          </Link>

          {/* Right actions */}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login" className="text-sm font-medium">
              로그인
            </Link>
          </Button>
        </nav>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-24 text-center">
        {/* Badge pill */}
        <div className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3.5 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Discord 봇 연동 지원
        </div>

        {/* Main heading */}
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          블로그 스터디를
          <br />
          <span className="text-primary">더 스마트하게</span>
        </h1>

        {/* Subtext */}
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          봇이 글을 수집하고, 출석을 관리하고, 대시보드에서 한눈에 확인하세요.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <Button size="lg" asChild className="h-11 px-8 text-sm font-semibold">
            <Link href="/login">Discord로 시작하기</Link>
          </Button>
          <p className="text-xs text-muted-foreground">무료로 시작 · 설정 5분</p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Features                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          {/* Section header */}
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              필요한 기능, 전부 갖췄습니다
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              반복적인 스터디 운영 업무를 자동화하세요
            </p>
          </div>

          {/* Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-lg border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <Icon className="mb-4 h-10 w-10 text-primary" strokeWidth={1.5} />
                <h3 className="mb-1.5 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer className="mt-auto border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 블로그 스터디</span>
          <Link href="#" className="transition-colors hover:text-foreground">
            GitHub
          </Link>
        </div>
      </footer>
    </div>
  );
}
