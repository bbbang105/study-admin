'use client';

import Link from 'next/link';
import {
  CalendarCheck,
  FileText,
  LogIn,
  MessageSquare,
  Rss,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { CountUp, DrawLine, FadeUp, StaggerContainer, StaggerItem } from './motion';
import { ExternalLinkIcon } from '@/components/ui/external-link';

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
      <div className="landing-glow absolute inset-0 pointer-events-none" aria-hidden="true" />
      {/* Grid pattern overlay */}
      <div className="grid-pattern absolute inset-0 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Badge pill */}
        <FadeUp delay={0}>
          <div className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            큐스팅 4th 블로그 스터디
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
            혼자 쓰면 멈추게 되지만, 함께 쓰면 계속하게 돼요.
            <br className="hidden sm:block" />
            2주에 한 편, 서로의 글에 응원을 나누며 꾸준함을 만들어가는 스터디입니다.
          </p>
        </FadeUp>

        {/* CTA */}
        <FadeUp delay={0.3}>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/login"
              className="glow-button btn-gradient inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white"
            >
              Discord로 참여하기
            </Link>
          </div>
        </FadeUp>

        <FadeUp delay={0.4}>
          <p className="mt-3 text-xs text-zinc-400">Discord 계정만 있으면 바로 참여 가능</p>
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
              <span className="text-sm text-zinc-400">활동 중</span>
            </div>

            <div className="hidden h-10 w-px bg-white/10 sm:block" />

            {/* Posts */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-3xl font-bold text-white">
                <CountUp target={stats.posts} suffix="개" />
              </span>
              <span className="text-sm text-zinc-400">글 수집</span>
            </div>

            <div className="hidden h-10 w-px bg-white/10 sm:block" />

            {/* Round */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-3xl font-bold text-white">
                <CountUp target={stats.round} suffix="회차" />
              </span>
              <span className="text-sm text-zinc-400">진행 중</span>
            </div>
          </div>
        </div>
      </section>
    </FadeUp>
  );
}

/** Mock UI 미리보기 — 포스트 피드 */
function MockPosts() {
  return (
    <div className="mt-4 space-y-2">
      {[
        { name: 'alice', title: 'React 19의 새로운 기능 정리', comments: 3, views: 12 },
        { name: 'bob', title: 'Docker 멀티스테이지 빌드 최적화', comments: 1, views: 8 },
      ].map((p) => (
        <div
          key={p.name}
          className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.dicebear.com/9.x/fun-emoji/svg?seed=${p.name}`}
            alt=""
            width={24}
            height={24}
            className="rounded-full shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white truncate">{p.title}</p>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span>{p.name}</span>
              <span>💬 {p.comments}</span>
              <span>👀 {p.views}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mock UI 미리보기 — 랭킹 & 활동 점수 */
function MockRanking() {
  const ranks = [
    { rank: 1, name: 'alice', score: 420, medal: 'bg-amber-400' },
    { rank: 2, name: 'bob', score: 385, medal: 'bg-slate-300' },
    { rank: 3, name: 'charlie', score: 310, medal: 'bg-orange-400' },
  ];
  return (
    <div className="mt-4 space-y-1.5">
      {ranks.map((r) => (
        <div
          key={r.rank}
          className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2"
        >
          <span
            className={`h-5 w-5 rounded-full ${r.medal} flex items-center justify-center text-[10px] font-bold text-black`}
          >
            {r.rank}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.dicebear.com/9.x/fun-emoji/svg?seed=${r.name}`}
            alt=""
            width={22}
            height={22}
            className="rounded-full"
          />
          <span className="text-xs text-white flex-1">{r.name}</span>
          <span className="text-xs font-semibold text-blue-400 tabular-nums">{r.score}pt</span>
        </div>
      ))}
    </div>
  );
}

/** Mock UI 미리보기 — 활동 점수 */
function MockScoreProgress() {
  const items = [
    { emoji: '📝', label: '블로그', earned: 10, cap: 10, full: true },
    { emoji: '💬', label: '댓글', earned: 6, cap: 10, full: false },
    { emoji: '📋', label: '게시판', earned: 3, cap: 5, full: false },
    { emoji: '👀', label: '조회', earned: 10, cap: 10, full: true },
  ];
  return (
    <div className="mt-4">
      <div className="rounded-lg bg-white/[0.03] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">오늘의 활동</span>
          <span className="text-xs font-semibold text-blue-400">+29pt</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1.5 rounded bg-white/[0.02] px-2 py-1.5"
            >
              <span className="text-xs">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">{item.label}</span>
                  <span className="text-[9px] text-zinc-500">
                    {item.earned}/{item.cap}
                  </span>
                </div>
                <div className="mt-0.5 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.full ? 'bg-emerald-400' : 'bg-blue-400'}`}
                    style={{ width: `${(item.earned / item.cap) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mock UI 미리보기 — 커뮤니티 게시판 */
function MockBoard() {
  return (
    <div className="mt-4 space-y-2">
      <div className="rounded-lg bg-white/[0.03] p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
            지식공유
          </span>
          <span className="text-xs text-white">Next.js 15 → 16 마이그레이션 팁</span>
        </div>
        <div className="flex items-center gap-2 ml-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.dicebear.com/9.x/fun-emoji/svg?seed=dave"
            alt=""
            width={18}
            height={18}
            className="rounded-full"
          />
          <p className="text-[10px] text-zinc-400">오 저도 이거 때문에 삽질했는데...</p>
        </div>
      </div>
      <div className="rounded-lg bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            일상
          </span>
          <span className="text-xs text-white">큐스팅 4기 시작 회식 🍻</span>
        </div>
      </div>
    </div>
  );
}

/** Mock UI 미리보기 — 스터디원 */
function MockMembers() {
  const ppl = [
    { name: 'eve', part: 'FE', score: 280 },
    { name: 'frank', part: 'BE', score: 195 },
    { name: 'grace', part: 'AI', score: 150 },
  ];
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {ppl.map((m) => (
          <div
            key={m.name}
            className="flex-1 flex flex-col items-center gap-1.5 rounded-lg bg-white/[0.03] py-3 px-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.dicebear.com/9.x/fun-emoji/svg?seed=${m.name}`}
              alt=""
              width={28}
              height={28}
              className="rounded-full"
            />
            <span className="text-[11px] text-white">{m.name}</span>
            <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-medium text-blue-400">
              {m.part}
            </span>
            <span className="text-[10px] text-zinc-500">{m.score}pt</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mock UI 미리보기 — 대시보드 */
function MockDashboard() {
  return (
    <div className="mt-4 space-y-2">
      <div className="rounded-lg bg-white/[0.03] px-3 py-2">
        <p className="text-xs text-white">☀️ 좋은 아침이에요, alice님</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          ✍️ 완벽한 글은 없어요. 일단 쓰기 시작하면 그게 최고의 글이에요.
        </p>
      </div>
      <div className="rounded-lg bg-white/[0.03] p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white">3회차</span>
          <span className="text-sm font-bold text-blue-400">D-5</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">나의 출석</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            ✓ 제출 완료
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">제출률</span>
            <span className="text-[10px] font-medium text-white">75%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturesBento() {
  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <FadeUp>
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">이런 것들을 함께 해요</h2>
            <p className="mt-3 text-base text-zinc-400">
              글쓰기에만 집중하세요. 나머지는 알아서 돌아가요.
            </p>
          </div>
        </FadeUp>

        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: TrendingUp,
              title: '나만의 대시보드',
              desc: '내 현황을 한눈에 확인',
              mock: <MockDashboard />,
            },
            {
              icon: Trophy,
              title: '랭킹 & 활동 점수',
              desc: '글 쓰고, 댓글 달고, 점수 쌓기',
              mock: <MockRanking />,
            },
            {
              icon: FileText,
              title: '포스트 피드',
              desc: '스터디원들의 글을 모아서',
              mock: <MockPosts />,
            },
            {
              icon: CalendarCheck,
              title: '활동 점수',
              desc: '쓰고, 읽고, 댓글 달면 점수 적립',
              mock: <MockScoreProgress />,
            },
            {
              icon: MessageSquare,
              title: '자유 게시판',
              desc: '후기, 건의, 지식 공유',
              mock: <MockBoard />,
            },
            {
              icon: Rss,
              title: '함께하는 스터디원',
              desc: '다양한 분야의 사람들과',
              mock: <MockMembers />,
            },
          ].map(({ icon: Icon, title, desc, mock }) => (
            <StaggerItem key={title}>
              <div className="bento-card rounded-2xl p-5 flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <Icon className="h-4.5 w-4.5 text-blue-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    <p className="text-[11px] text-zinc-500">{desc}</p>
                  </div>
                </div>
                {mock}
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
                aria-hidden="true"
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
      <div
        className="landing-glow-bottom absolute inset-0 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-2xl">
        <FadeUp delay={0}>
          <h2 className="text-3xl font-bold tracking-tight gradient-text">
            함께 글쓰기, 시작해볼까요?
          </h2>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="mt-8">
            <Link
              href="/login"
              className="glow-button btn-gradient inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white"
            >
              Discord로 참여하기
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
        <p className="text-xs text-zinc-400">
          © {new Date().getFullYear()} 큐스팅 4th · Built by{' '}
          <a
            href="https://github.com/bbbang105"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors inline-flex items-center gap-1"
          >
            @bbbang105
            <ExternalLinkIcon />
          </a>
          {' & '}
          <a
            href="https://github.com/choihooo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors inline-flex items-center gap-1"
          >
            @choihooo
            <ExternalLinkIcon />
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
      <a href="#main-content" className="skip-to-content">
        본문으로 바로가기
      </a>
      <Nav />
      <main id="main-content" tabIndex={-1}>
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
