'use client';

import Link from 'next/link';
import {
  Banknote,
  CalendarCheck,
  FileText,
  LogIn,
  MessageSquare,
  Newspaper,
  Rss,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { CountUp, DrawLine, FadeUp, StaggerContainer, StaggerItem } from './motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LandingStats {
  members: number;
  posts: number;
  round: number;
}

interface LandingClientProps {
  stats: LandingStats;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STEPS = [
  {
    icon: LogIn,
    title: 'Discord 로그인',
    description: '클릭 한 번으로 가입 완료',
  },
  {
    icon: FileText,
    title: '블로그 글 작성',
    description: '글을 쓰면 봇이 자동으로 수집',
  },
  {
    icon: TrendingUp,
    title: '성장 확인',
    description: '대시보드에서 랭킹과 통계 확인',
  },
] as const;

const AVATAR_SEEDS = [
  'alice',
  'bob',
  'charlie',
  'dave',
  'eve',
  'frank',
  'grace',
  'heidi',
  'ivan',
  'judy',
  'karl',
  'lisa',
  'mike',
  'nina',
  'oscar',
  'pat',
  'quinn',
  'rachel',
  'steve',
  'tina',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Nav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="큐스팅 4th" width={28} height={28} />
          <span className="text-sm font-semibold text-white">큐스팅 4th</span>
        </Link>

        <Link
          href="/login"
          className="glow-button btn-gradient inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
        >
          Discord 로그인
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100vh-56px)] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      {/* Glow background */}
      <div className="landing-glow absolute inset-0 pointer-events-none" />
      {/* Grid pattern overlay */}
      <div className="grid-pattern absolute inset-0 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Badge pill */}
        <FadeUp delay={0}>
          <div className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            큐스팅 4th 관리 플랫폼
          </div>
        </FadeUp>

        {/* Headline */}
        <FadeUp delay={0.1}>
          <h1 className="max-w-3xl text-5xl font-bold tracking-tighter sm:text-6xl lg:text-7xl text-white">
            함께 쓰고,
            <br />
            <span className="gradient-text">함께 성장하다.</span>
          </h1>
        </FadeUp>

        {/* Subtext */}
        <FadeUp delay={0.2}>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            글을 쓰면 봇이 수집하고, 출석을 관리하고, 대시보드에서 모든 활동을 한눈에 확인하세요.
          </p>
        </FadeUp>

        {/* CTA */}
        <FadeUp delay={0.3}>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/login"
              className="glow-button btn-gradient inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white"
            >
              Discord로 시작하기
            </Link>
          </div>
        </FadeUp>

        <FadeUp delay={0.4}>
          <p className="mt-3 text-xs text-zinc-500">무료 · 설정 5분 완료</p>
        </FadeUp>
      </div>
    </section>
  );
}

function StatsBar({ stats }: { stats: LandingStats }) {
  return (
    <FadeUp>
      <section className="border-y border-white/5 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-around">
            {/* Members */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-3xl font-bold text-white">
                <CountUp target={stats.members} suffix="명" />
              </span>
              <span className="text-sm text-zinc-500">활동 중</span>
            </div>

            <div className="hidden h-10 w-px bg-white/10 sm:block" />

            {/* Posts */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-3xl font-bold text-white">
                <CountUp target={stats.posts} suffix="개" />
              </span>
              <span className="text-sm text-zinc-500">글 수집</span>
            </div>

            <div className="hidden h-10 w-px bg-white/10 sm:block" />

            {/* Round */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-3xl font-bold text-white">
                <CountUp target={stats.round} suffix="회차" />
              </span>
              <span className="text-sm text-zinc-500">진행 중</span>
            </div>
          </div>
        </div>
      </section>
    </FadeUp>
  );
}

function FeaturesBento() {
  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <FadeUp>
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              필요한 기능, 전부 갖췄습니다
            </h2>
            <p className="mt-3 text-base text-zinc-400">반복적인 스터디 운영 업무를 자동화하세요</p>
          </div>
        </FadeUp>

        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Rss, title: 'RSS 자동 수집', desc: '블로그 글 발행 시 자동 감지 및 수집' },
            {
              icon: Trophy,
              title: '랭킹 & 활동 점수',
              desc: '글 작성·댓글·출석 등 활동 기반 점수 시스템',
            },
            { icon: CalendarCheck, title: '출석 자동화', desc: '2주 1회차, 지각·결석 자동 판정' },
            {
              icon: MessageSquare,
              title: '커뮤니티 게시판',
              desc: 'Tiptap 에디터, 댓글, 비밀글 지원',
            },
            { icon: Banknote, title: '벌금 관리', desc: '자동 부과, DM 알림, 납부 확인' },
            { icon: Newspaper, title: '큐레이션', desc: '관심 키워드 기반 아티클·컨퍼런스 추천' },
          ].map(({ icon: Icon, title, desc }) => (
            <StaggerItem key={title}>
              <div className="bento-card rounded-2xl p-6">
                <Icon className="h-8 w-8 text-blue-400" strokeWidth={1.5} />
                <h3 className="mt-4 mb-2 text-base font-semibold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <FadeUp>
          <h2 className="mb-16 text-center text-3xl font-bold tracking-tight text-white">
            어떻게 시작하나요?
          </h2>
        </FadeUp>

        <StaggerContainer className="relative flex flex-col gap-10 md:flex-row md:items-start md:gap-0">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === STEPS.length - 1;

            return (
              <StaggerItem
                key={step.title}
                className="relative flex flex-1 flex-col items-center text-center"
              >
                {/* Connector line between steps */}
                {!isLast && (
                  <DrawLine className="absolute top-6 left-1/2 hidden h-px w-full bg-gradient-to-r from-blue-500/40 to-blue-500/10 md:block" />
                )}

                {/* Step number circle with gradient border */}
                <div
                  className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #0091FF 0%, #004DFF 100%)',
                    padding: '1.5px',
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-950">
                    <span className="text-sm font-bold text-white">{index + 1}</span>
                  </div>
                </div>

                {/* Icon */}
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <Icon className="h-5 w-5 text-blue-400" strokeWidth={1.5} />
                </div>

                {/* Text */}
                <h3 className="mb-2 text-base font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-zinc-500">{step.description}</p>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}

function AvatarMarquee() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <FadeUp>
          <p className="mb-8 text-center text-sm text-zinc-400">함께하는 스터디원들</p>
        </FadeUp>

        <div className="overflow-hidden">
          <div className="animate-marquee flex gap-4 w-max">
            {[...AVATAR_SEEDS, ...AVATAR_SEEDS].map((seed, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${seed}-${i}`}
                src={`https://api.dicebear.com/9.x/fun-emoji/svg?seed=${seed}`}
                alt=""
                width={48}
                height={48}
                className="rounded-full border border-white/10 shrink-0"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-32 text-center">
      <div className="landing-glow-bottom absolute inset-0 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-2xl">
        <FadeUp delay={0}>
          <h2 className="text-3xl font-bold tracking-tight gradient-text">지금 바로 시작하세요.</h2>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="mt-8">
            <Link
              href="/login"
              className="glow-button btn-gradient inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white"
            >
              Discord로 시작하기
            </Link>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-8">
      <div className="mx-auto max-w-6xl text-center">
        <p className="text-xs text-zinc-600">
          © {new Date().getFullYear()} 큐스팅 4th · Built by{' '}
          <a
            href="https://github.com/bbbang105"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors"
          >
            @bbbang105
          </a>
          {' & '}
          <a
            href="https://github.com/choihooo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors"
          >
            @choihooo
          </a>
        </p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function LandingClient({ stats }: LandingClientProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Nav />
      <main>
        <Hero />
        <StatsBar stats={stats} />
        <FeaturesBento />
        <HowItWorks />
        <AvatarMarquee />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
