# Blog Study Discord Bot

블로그 글쓰기 스터디 자동화 플랫폼. Discord 봇 + 웹 대시보드 + AI 추천.

## 프로젝트 구조

```
packages/
├── bot/      # Discord 봇 (discord.js v14) → Railway 배포
├── web/      # Next.js 15 대시보드 → Vercel 배포
└── shared/   # 공유 코드 (DB 스키마, 타입, 유틸)
```

**모노레포**: pnpm workspace (`pnpm-workspace.yaml`)

## 기술 스택

| 영역 | 기술 |
|------|------|
| Runtime | Node.js 20 LTS, TypeScript 5.x |
| Bot | discord.js v14, feedsmith (RSS), pg-boss (job queue) |
| Web | Next.js 15 App Router, shadcn/ui, Tailwind CSS v4 |
| DB | Supabase PostgreSQL + Drizzle ORM + pgvector |
| Auth | Supabase Auth (Discord OAuth) |
| AI | OpenAI GPT-4o-mini (요약/키워드), text-embedding-3-small (벡터) |
| 배포 | Railway (bot), Vercel (web), Supabase (DB) |

## 개발 명령어

```bash
# 개발
pnpm dev:bot          # 봇 로컬 실행
pnpm dev:web          # 웹 로컬 실행 (localhost:3000)

# 빌드/테스트
pnpm build            # 전체 빌드
pnpm test             # 전체 테스트
pnpm lint             # 전체 린트
pnpm typecheck        # 타입 체크

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
| `packages/shared/src/types/index.ts` | 공유 enum/타입 |
| `packages/bot/src/bot.ts` | Discord 클라이언트 초기화 |
| `packages/bot/src/commands/index.ts` | 커맨드 레지스트리 |
| `packages/bot/src/services/` | 비즈니스 로직 서비스 |
| `packages/bot/src/schedulers/` | 크론 작업 (RSS, 출석, 벌금) |
| `packages/web/src/app/` | Next.js 페이지/라우트 |
| `packages/web/middleware.ts` | 인증 미들웨어 |

## UI 디자인 시스템

- **스타일**: Vercel 화이트/블랙 미니멀 + 스카이블루 포인트
- **컴포넌트**: shadcn/ui + Radix UI
- **아이콘**: lucide-react
- **다크모드**: next-themes (시스템 연동)
- **폰트**: Pretendard Variable
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
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`
- `OPENAI_API_KEY` (AI 기능용)

## 문서

| 문서 | 설명 |
|------|------|
| `docs/ARCHITECTURE.md` | 시스템 아키텍처 |
| `docs/TECH-DECISIONS.md` | 기술 선택 근거 |
| `docs/UI-DESIGN-SYSTEM.md` | UI 디자인 시스템 스펙 |
| `docs/DEVELOPMENT.md` | 개발 환경 설정 |
| `docs/CHECKLIST.md` | 구현 체크리스트 |
