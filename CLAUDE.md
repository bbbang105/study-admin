# Blog Study Discord Bot

블로그 글쓰기 스터디 자동화 플랫폼. Discord 봇 + 웹 대시보드 + AI 추천.

## 프로젝트 구조

```
packages/
├── bot/      # Discord 봇 (discord.js v14) → AWS EC2 배포
├── web/      # Next.js 14 대시보드 → Vercel 배포
└── shared/   # 공유 코드 (DB 스키마, 타입, 유틸)
```

**모노레포**: pnpm workspace (`pnpm-workspace.yaml`)

## 기술 스택

| 영역 | 기술 |
|------|------|
| Runtime | Node.js 22, TypeScript 5.x |
| Bot | discord.js v14, feedsmith (RSS 파서), pg-boss (PostgreSQL 잡 큐) |
| Web | Next.js 14 App Router, React 18, shadcn/ui, Tailwind CSS v3 |
| DB | Supabase PostgreSQL + Drizzle ORM (Transaction Pooler, `prepare: false`) |
| Auth | Supabase Auth (Discord OAuth) + `@supabase/ssr` |
| AI | OpenAI GPT-4o-mini + text-embedding-3-small (예정) |
| 배포 | AWS EC2 (bot), Vercel (web), Supabase (DB + Auth) |

## 개발 명령어

```bash
# 개발
pnpm dev:bot          # 봇 로컬 실행
pnpm dev:web          # 웹 로컬 실행 (localhost:3000)

# 빌드/테스트
pnpm build            # 전체 빌드 (shared → bot/web)
pnpm test             # 전체 테스트
pnpm lint             # 전체 린트
pnpm typecheck        # 타입 체크

# shared 패키지 변경 시
pnpm --filter @blog-study/shared build   # 반드시 리빌드

# 봇 전용
pnpm --filter @blog-study/bot deploy-commands  # 슬래시 커맨드 등록
pnpm --filter @blog-study/bot init-rounds      # 회차 초기화
```

## 코딩 컨벤션

- **언어**: 모든 코드는 TypeScript strict 모드
- **스타일**: Prettier + ESLint (설정 파일 참조)
- **폰트**: Pretendard (한국어 최적화)
- **네이밍**: camelCase (변수/함수), PascalCase (컴포넌트/타입), kebab-case (파일명)
- **DB 컬럼**: snake_case (Drizzle ORM이 자동 매핑)
- **커밋**: 기존 git log 스타일 따름, Co-Authored-By 포함
- **한글 커맨드**: Discord 슬래시 명령어는 한글 (예: `/참가`, `/현황`)

## 핵심 파일 위치

| 파일 | 설명 |
|------|------|
| `packages/shared/src/db/schema.ts` | 전체 DB 스키마 (Drizzle) |
| `packages/shared/src/db/index.ts` | DB 연결 (Transaction Pooler, `prepare: false`) |
| `packages/web/src/lib/supabase/client.ts` | 브라우저용 Supabase 클라이언트 |
| `packages/web/src/lib/supabase/server.ts` | 서버용 Supabase 클라이언트 (cookies) |
| `packages/web/src/lib/supabase/middleware.ts` | 미들웨어용 세션 갱신 |
| `packages/web/middleware.ts` | 라우트 보호 (protected/admin/auth) |
| `packages/web/src/app/auth/callback/route.ts` | OAuth 콜백 |
| `packages/web/src/lib/admin.ts` | 관리자 권한 체크 |
| `packages/web/src/app/` | Next.js 페이지/라우트 |
| `packages/bot/src/bot.ts` | Discord 클라이언트 초기화 |
| `packages/bot/src/commands/index.ts` | 커맨드 레지스트리 |
| `packages/bot/src/job-queue.ts` | pg-boss 싱글톤 (시작/종료/조회) |
| `packages/bot/src/scheduler-registry.ts` | 7개 잡 등록 + RSS→Post→Notification 파이프라인 |

## 인증 구조

- **웹**: Supabase Auth → Discord OAuth → `user.identities[].id` (Discord ID) → `members.discord_id` 매칭
- **봇**: `service_role` key로 직접 DB 접근, `interaction.user.id`로 Discord ID 획득
- **미들웨어**: `@supabase/ssr`의 `updateSession()`으로 세션 자동 갱신
- **관리자**: `ADMIN_DISCORD_IDS` 환경변수로 Discord ID 기반 권한 체크
- **API Route**: `createClient()` → `getUser()` → `identities` 배열에서 Discord ID 추출

## UI 디자인 시스템

- **스타일**: Vercel 화이트/블랙 미니멀 + 스카이블루 포인트
- **컴포넌트**: shadcn/ui + Radix UI
- **아이콘**: lucide-react
- **다크모드**: next-themes (시스템 연동)
- **폰트**: Pretendard Variable
- **기본 아바타**: DiceBear `fun-emoji` 스타일 (`getDefaultAvatar()` in `utils.ts`)
- **아바타 리소스**: [DiceBear](https://www.dicebear.com/styles/) - 30+ 스타일, seed 기반 결정적 아바타 생성, API: `https://api.dicebear.com/9.x/{style}/svg?seed={seed}`
- **상세 스펙**: `docs/UI-DESIGN-SYSTEM.md` 참조

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
- `OPENAI_API_KEY` (AI 기능용, 예정)

**주의**: `packages/web/.env.local`에도 동일 환경변수 필요 (Next.js는 패키지 디렉토리 기준)

## 문서

| 문서 | 설명 |
|------|------|
| `docs/ARCHITECTURE.md` | 시스템 아키텍처 (Mermaid 다이어그램) |
| `docs/TECH-DECISIONS.md` | 기술 선택 근거 (ADR) |
| `docs/UI-DESIGN-SYSTEM.md` | UI 디자인 시스템 스펙 |
| `docs/DEVELOPMENT.md` | 개발 환경 설정 |
| `docs/CHECKLIST.md` | 구현 체크리스트 |
