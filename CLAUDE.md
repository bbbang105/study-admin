# Blog Study Discord Bot

블로그 글쓰기 스터디 자동화 플랫폼. 웹 대시보드(관리+유저) + Discord 봇(스케줄러+이벤트).

## 프로젝트 구조

```
packages/
├── bot/      # Discord 봇 (스케줄러 + 이벤트 핸들러만, 슬래시 커맨드 없음) → AWS EC2 (Docker)
├── web/      # Next.js 16 대시보드 → Vercel 배포
└── shared/   # 공유 코드 (DB 스키마, 타입, 유틸)
deploy/
└── bot/      # EC2 배포 스크립트 (deploy.sh) — 리포에 커밋하지 않음, EC2에 직접 배치
```

**모노레포**: pnpm workspace (`pnpm-workspace.yaml`)

## 기술 스택

| 영역 | 기술 |
|------|------|
| Runtime | Node.js 22, TypeScript 5.x |
| Bot | discord.js v14, feedsmith (RSS 파서), pg-boss (PostgreSQL 잡 큐), Sentry (에러 모니터링) |
| Web | Next.js 16 App Router, React 19, shadcn/ui, Tailwind CSS v4, Tiptap (리치 에디터), sonner (토스트), Framer Motion (랜딩 애니메이션), Sentry (에러 모니터링) |
| DB | Supabase PostgreSQL + Drizzle ORM (Transaction Pooler, `prepare: false`) |
| Auth | Supabase Auth (Discord OAuth) + `@supabase/ssr` |
| 배포 | AWS EC2 Docker (bot), Vercel (web), Supabase (DB + Auth) |
| CI/CD | GitHub Actions → ECR → SSH deploy (bot), Vercel Git Integration (web) |

## 개발 명령어

```bash
# 개발
pnpm dev:bot          # 봇 로컬 실행
pnpm dev:web          # 웹 로컬 실행 (localhost:3300)

# 빌드/테스트
pnpm build            # 전체 빌드 (shared → bot/web)
pnpm test             # 전체 테스트
pnpm lint             # 전체 린트
pnpm typecheck        # 타입 체크

# shared 패키지 변경 시
pnpm --filter @blog-study/shared build   # 반드시 리빌드

# 봇 전용
pnpm --filter @blog-study/bot rss-collect      # 수동 RSS 수집 (봇 없이)
```

## 코딩 컨벤션

- **언어**: 모든 코드는 TypeScript strict 모드
- **스타일**: Prettier + ESLint (설정 파일 참조)
- **폰트**: Pretendard (한국어 최적화)
- **네이밍**: camelCase (변수/함수), PascalCase (컴포넌트/타입), kebab-case (파일명)
- **DB 컬럼**: snake_case (Drizzle ORM이 자동 매핑)
- **커밋**: 기존 git log 스타일 따름, Co-Authored-By 포함
- **Drizzle SQL**: `packages/shared/drizzle/*.sql` 마이그레이션 파일은 로컬 전용 (`.gitignore`에 등록됨, 커밋 금지)
- **다이얼로그**: `window.confirm()`, `window.alert()`, `window.prompt()` 사용 금지 → 커스텀 다이얼로그 컴포넌트 사용 (기존 `DeletePostDialog` 패턴 참고)
- **토스트**: `sonner` 라이브러리 사용 (`toast.success()`, `toast.error()`) — inline 상태 관리 토스트 금지
- **API 응답**: 모든 API 라우트는 `Errors.*()` + `successResponse()` + `errorResponse()` 패턴 사용 (직접 `NextResponse.json` 금지)
- **캐시**: 읽기 전용 API에 `withCache(response, maxAge)` 적용 (members: 60s, ranking: 30s)
- **보안**: Tiptap content는 저장 전 `sanitizeTiptapContent()` 적용, 외부 URL fetch 시 `isSafeUrl()` SSRF 체크

## 핵심 파일 위치

| 파일 | 설명 |
|------|------|
| `packages/shared/src/db/schema.ts` | 전체 DB 스키마 (Drizzle) |
| `packages/shared/src/db/index.ts` | DB 연결 (Transaction Pooler, `prepare: false`) |
| `packages/web/src/lib/supabase/client.ts` | 브라우저용 Supabase 클라이언트 |
| `packages/web/src/lib/supabase/server.ts` | 서버용 Supabase 클라이언트 (cookies) |
| `packages/web/src/lib/supabase/middleware.ts` | 미들웨어용 세션 갱신 |
| `packages/web/src/app/(user)/layout.tsx` | 사용자 레이아웃 (인증 체크 + 상태별 리다이렉트) |
| `packages/web/src/app/auth/callback/route.ts` | OAuth 콜백 + 상태별 리다이렉트 |
| `packages/web/src/lib/admin.ts` | 관리자 권한 체크 (`withAdminAuth`) |
| `packages/web/src/lib/member-config.ts` | 멤버 상태별 라벨/뱃지 설정 |
| `packages/web/src/lib/rss-detect.ts` | 블로그 URL → RSS URL 자동 감지 |
| `packages/web/src/app/(user)/layout.tsx` | 사용자 레이아웃 (상태 체크 + 리다이렉트) |
| `packages/web/src/app/` | Next.js 페이지/라우트 |
| `packages/bot/src/lib/sentry.ts` | 봇 Sentry SDK 초기화 (PII 스크러빙, DB URL/토큰 마스킹) |
| `packages/bot/src/bot.ts` | Discord 클라이언트 초기화 (이벤트 핸들러만) |
| `packages/bot/src/job-queue.ts` | pg-boss 싱글톤 (시작/종료/조회) |
| `packages/bot/src/scheduler-registry.ts` | 잡 등록 + RSS→Post→Notification 파이프라인 |
| `packages/bot/src/services/score.service.ts` | 활동 점수 계산/부여 (봇: blog_post만) |
| `packages/web/src/lib/score.ts` | 웹 활동 점수 부여 (board_post, post_comment, board_comment, post_view) |
| `packages/web/src/lib/score-config.ts` | 활동 점수 타입별 메타데이터 (Single Source of Truth: 라벨, 이모지, 배점, 뱃지 컬러) |
| `packages/web/src/app/(user)/profile/activity/page.tsx` | 활동 내역 페이지 (타입별 필터, 무한 로드) |
| `packages/web/src/lib/board-auth.ts` | 게시판 인증 헬퍼 (`getBoardAuth`) |
| `packages/web/src/lib/board-config.ts` | 게시판 카테고리/뱃지 설정 |
| `packages/web/src/lib/api-error.ts` | API 표준 응답/에러 헬퍼 (`successResponse`, `Errors`, `withCache`) |
| `packages/web/src/lib/sanitize.ts` | 입력 새니타이즈 (`sanitizeDescription`, `sanitizeTiptapContent`, `getTodayKST`) |
| `packages/web/src/app/not-found.tsx` | 커스텀 404 페이지 |
| `packages/web/src/app/(user)/error.tsx` | 사용자 에러 바운더리 |
| `packages/web/src/app/(admin)/error.tsx` | 관리자 에러 바운더리 |
| `packages/web/src/components/ui/member-avatar.tsx` | 재사용 아바타 컴포넌트 (링크+관리자뱃지) |
| `packages/web/src/components/board/tiptap-editor.tsx` | Tiptap 리치 에디터 (H1-H3, 구분선, 코드블록, 링크, 한글 IME 대응) |
| `packages/web/src/components/layout/bottom-nav.tsx` | 모바일 하단 탭 바 (사용자: 랭킹/포스트/홈/게시판/스터디원, 관리자: 멤버/회차/출석/벌금/점수/봇) |
| `packages/web/src/components/layout/notice-banner.tsx` | 글로벌 공지 배너 (제목+내용 미리보기, 접기/닫기) |
| `packages/web/src/components/layout/pull-to-refresh.tsx` | Pull-to-Refresh 컴포넌트 (PWA 터치 제스처) |
| `packages/web/src/hooks/use-pull-to-refresh.ts` | Pull-to-Refresh 훅 (`window.location.reload()` 기반) |
| `packages/web/src/app/api/notice-banner/route.ts` | 활성 공지 배너 조회 API |
| `packages/web/src/app/(admin)/admin/bot-operations/page.tsx` | 봇 수동 실행 대시보드 (관리자 전용) |
| `packages/web/src/app/api/admin/bot-operations/[operationId]/route.ts` | 봇 작업 트리거 프록시 (web → bot HTTP API, 30s 타임아웃) |
| `packages/web/src/app/(admin)/admin/rounds/page.tsx` | 회차 관리 페이지 (CRUD + 현재 회차 설정) |
| `packages/web/src/app/api/profile/withdraw/route.ts` | 유저 자체 탈퇴 API |
| `packages/bot/src/scripts/rss-collect.ts` | 수동 RSS 수집 스크립트 (봇 없이 독립 실행) |
| `packages/bot/src/scripts/setup-channels.ts` | 디스코드 채널 일괄 생성 스크립트 |
| `packages/bot/src/scripts/list-channels.ts` | 서버 채널 구조 조회 스크립트 |
| `packages/bot/src/api-server.ts` | 봇 HTTP API 서버 (Express, 수동 트리거 엔드포인트, rate limit 10/min) |
| `packages/bot/src/services/round.service.ts` | 회차 관리 + ConfigKeys (announcement/notice/curation 채널) |
| `packages/web/src/components/landing/landing-client.tsx` | 랜딩 페이지 클라이언트 (7섹션: Hero, Stats, Bento, HowItWorks, Marquee, CTA, Footer) |
| `packages/web/src/components/landing/motion.tsx` | 랜딩 애니메이션 컴포넌트 (FadeUp, StaggerContainer, CountUp, DrawLine) |
| `packages/web/public/logo.svg` | 풀 로고 SVG (픽토그램 + 텍스트) |
| `packages/bot/Dockerfile` | 봇 Docker 이미지 (multi-stage, node:22-alpine) |
| `.github/workflows/bot-deploy.yml` | 봇 CI/CD (CI Gate → ECR 빌드/푸시 → SSH 배포) |
| `.github/workflows/ci.yml` | PR/push CI (lint, typecheck, test, build) |
| `packages/web/next.config.ts` | Next.js 설정 + Sentry `withSentryConfig` 래핑 |
| `packages/web/sentry.client.config.ts` | Sentry 클라이언트 SDK 초기화 (DSN 가드, PII 스크러빙) |
| `packages/web/sentry.server.config.ts` | Sentry 서버 SDK 초기화 |
| `packages/web/sentry.edge.config.ts` | Sentry Edge SDK 초기화 |
| `packages/web/instrumentation.ts` | Next.js instrumentation hook (Sentry 서버/엣지 등록) |
| `packages/web/src/app/global-error.tsx` | 전역 에러 바운더리 (Sentry 전송 + 다크모드 대응) |

## 인증 구조

- **웹**: Supabase Auth → Discord OAuth → `user.identities[].id` (Discord ID) → `members.discord_id` 매칭
- **봇**: `service_role` key로 직접 DB 접근 (스케줄러/이벤트 핸들러 전용, 슬래시 커맨드 없음)
- **미들웨어**: 없음 (Next.js 16 + Sentry withSentryConfig 비호환). 인증 체크는 각 layout에서 처리
- **관리자**: `(admin)/layout.tsx`에서 `/api/admin/check` 호출 → 미인증 시 로그인, 비관리자 시 접근 거부 다이얼로그. API는 `withAdminAuth` 래퍼로 서버사이드 권한 체크
- **API Route**: `createClient()` → `getUser()` → `identities` 배열에서 Discord ID 추출
- **상태 리다이렉트**: `auth/callback` + `(user)/layout.tsx`에서 이중 체크 → 상태별 차단 페이지로 리다이렉트
- **랜딩 페이지**: 서버 사이드 `getUser()` 체크 → 인증 유저는 `/dashboard`로 redirect

## 멤버 상태 규칙

| 상태 | 접근 | 출석/벌금 | 비고 |
|------|------|-----------|------|
| `pending_approval` | 차단 (`/pending`) | 제외 | 온보딩 후 기본 상태 |
| `active` | 허용 | 대상 | 관리자 승인 시 전환 |
| `inactive` | 차단 (`/inactive`) | 제외 | |
| `dormant` | 허용 | 제외 | 1회 사용 가능 |
| `ob` | 허용 | 제외 | 관리자 승인 시 선택 가능 |
| `withdrawn` | 차단 | 제외 | soft delete |

## UI 디자인 시스템

- **스타일**: Vercel 화이트/블랙 미니멀 + 스카이블루 포인트
- **컴포넌트**: shadcn/ui + Radix UI
- **아이콘**: lucide-react
- **다크모드**: next-themes (시스템 연동)
- **폰트**: Pretendard Variable
- **기본 아바타**: DiceBear `fun-emoji` 스타일 (`getDefaultAvatar()` in `utils.ts`)
- **아바타 리소스**: [DiceBear](https://www.dicebear.com/styles/) - 30+ 스타일, seed 기반 결정적 아바타 생성, API: `https://api.dicebear.com/9.x/{style}/svg?seed={seed}`
- **레이아웃**: 데스크톱 사이드바 + 모바일 하단 탭 바 (사용자/관리자 모드별 탭 자동 전환)
- **사이드바**: 모드 전환은 헤더 프로필 드롭다운에서만 가능 (사이드바에 토글 없음)
- **큐레이션**: 현재 네비게이션에서 숨김 (TODO: 나중에 활성화 예정), 페이지/로직은 유지
- **포스트**: 최신순/인기순 탭, 무한 스크롤, 썸네일(OG 이미지)+그라디언트 폴백, 인기순 상위 3개 금/은/동 메달
- **공지 배너**: 글로벌 상단 배너 (제목+내용 미리보기, 접기→제목만, 닫기→숨김, 관리자 페이지 미표시)
- **다이얼로그**: Safari PWA 스크롤 대응 (flex 레이아웃, `inset-y-0 my-auto` 센터링, `overflow-y-auto`, `data-scroll-locked` 가드)
- **Pull-to-Refresh**: 커스텀 터치 제스처 → `window.location.reload()` (Safari PWA 최적화, 다이얼로그 열림 시 비활성화)
- **PWA**: 홈 화면 추가 지원 (manifest.json, 서비스 워커 없음)
- **랜딩 페이지**: Linear 스타일 다크 모드 원페이지 (큐시즘 블루 그라디언트 `#0091FF→#004DFF`, Framer Motion 풀 애니메이션, DB 스탯 ISR 60s, 인증 유저 `/dashboard` 리다이렉트)
- **로고**: 커스텀 SVG 픽토그램 (펜촉+화살표, 큐시즘 블루 그라디언트), `icon.svg`/`icon-192.png`/`icon-512.png`
- **토스트**: sonner (`<Toaster />` in root layout, `position="bottom-center"`, `richColors`)
- **에러 바운더리**: `(user)/error.tsx`, `(admin)/error.tsx` — Sentry 전송 + 리셋 버튼, `global-error.tsx` — 전역 폴백 (다크모드 인라인 스타일)
- **404 페이지**: `not-found.tsx` — 대시보드 링크 포함
- **CSP**: `next.config.ts`에 Content-Security-Policy 헤더 설정
- **상세 스펙**: `docs/26-03-06-ui-design-system.md` 참조

## 에이전트 활용 가이드

### 서브에이전트 용도
| 에이전트 | 용도 |
|---------|------|
| `code-reviewer` | PR 리뷰, 코드 품질 체크 |
| `qa-expert` | 테스트 작성, QA 전략 |
| `security-auditor` | 보안 취약점 검토 |
| `frontend-developer` | UI 컴포넌트 구현, 반응형 |
| `devops-engineer` | 배포, CI/CD, 인프라 |
| `ui-designer` | 디자인 시스템, 컴포넌트 설계 |
| `accessibility-tester` | 접근성 검증 |

### 스킬 사용
| 커맨드 | 설명 |
|--------|------|
| `/safe-commit` | 변경 파일만 명시적 추가 후 커밋 |
| `/pr` | PR 생성 |
| `/review` | 코드 리뷰 |
| `/test` | 테스트 작성 |
| `/security` | 보안 검토 |
| `/devops` | DevOps 작업 |

## 테스트 전략

- **프레임워크**: Vitest + fast-check (Property-Based Testing)
- **구조**: `*.property.test.ts` (속성 테스트), `*.test.ts` (단위 테스트)
- **최소 100회 반복**: Property-Based Test
- **주석 형식**: `Property {N}: {설명}` → Correctness Property 매핑

## 환경 변수

`.env.example` 참조. 필수:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase)
- `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, `DATABASE_URL_DIRECT` (DB)
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`
- `ADMIN_DISCORD_IDS` (관리자 Discord ID, 쉼표 구분)
- `NEXT_PUBLIC_SENTRY_DSN` (Sentry 에러 모니터링, web 전용)
- `SENTRY_DSN` (Sentry 에러 모니터링, bot 전용)
- `SENTRY_AUTH_TOKEN` (소스맵 업로드, Vercel/CI에서만 설정)

**env 파일 위치** (2곳):
- `.env.local` — 루트 (shared/bot용)
- `packages/web/.env.local` — Next.js용

**주의**: `packages/web/.env.local`에도 동일 환경변수 필요 (Next.js는 패키지 디렉토리 기준)

## DB 마이그레이션

스키마 변경 시 drizzle-kit push까지 직접 실행:

```bash
cd packages/shared
export $(grep DATABASE_URL ../../.env.local | head -1 | xargs)
npx drizzle-kit push --force
```

## 문서

| 문서 | 설명 |
|------|------|
| `docs/ARCHITECTURE.md` | 시스템 아키텍처 (Mermaid 다이어그램) |
| `docs/26-03-06-tech-decisions.md` | 기술 선택 근거 (ADR) |
| `docs/26-03-06-ui-design-system.md` | UI 디자인 시스템 스펙 |
| `docs/26-03-06-development.md` | 개발 환경 설정 |
| `docs/26-03-06-checklist.md` | 구현 체크리스트 |
| `docs/26-03-06-schema-summary.md` | DB 스키마 요약 (테이블/Enum/FK) |
| `docs/26-03-06-patterns.md` | API 패턴 & 코드 규칙 |
| `docs/ONBOARDING.md` | 팀 온보딩 가이드 |
| `docs/26-03-08-discord-channel-setup.md` | 디스코드 채널 세팅 가이드 (큐스팅) |
| `docs/plans/26-03-08-landing-page-redesign-design.md` | 랜딩 페이지 리디자인 디자인 문서 |
| `docs/plans/26-03-08-landing-page-redesign.md` | 랜딩 페이지 구현 플랜 |

## 봇 배포 (CI/CD)

- **파이프라인**: `dev` push → CI Gate (lint+typecheck+test) → ECR 빌드(ARM64) → SSH 배포
- **트리거**: `packages/bot/**`, `packages/shared/**` 변경 시 + `workflow_dispatch`
- **EC2**: illdan-mgmt (t4g ARM64), `~/study-admin-bot/deploy.sh` + `.env`
- **ECR**: `699475955307.dkr.ecr.ap-northeast-2.amazonaws.com/study-admin-bot`
- **deploy.sh**: ECR 로그인 → pull → 컨테이너 교체 → health check → Discord 웹훅 알림
- **주의**: `deploy/bot/deploy.sh`는 커밋하지 않음 (EC2에 직접 배치)

## docs 파일명 컨벤션

`yy-mm-dd-{설명}.md` — 예: `26-03-03-system-architecture.md`
- 설명은 다른 문서와 구분될 정도로 구체적으로 작명
- `docs/plans/` 하위도 동일 컨벤션 적용
- 단, `docs/ARCHITECTURE.md`는 제외하며 업데이트 시에도 네이밍을 그대로 유지
