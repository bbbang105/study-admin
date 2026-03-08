# Blog Study Discord Bot

블로그 글쓰기 스터디 자동화 플랫폼. 웹 대시보드(관리+유저) + Discord 봇(스케줄러+이벤트).

## 프로젝트 구조

```
packages/
├── bot/      # Discord 봇 (스케줄러 + 이벤트 핸들러만, 슬래시 커맨드 없음) → AWS EC2 배포
├── web/      # Next.js 16 대시보드 → Vercel 배포
└── shared/   # 공유 코드 (DB 스키마, 타입, 유틸)
```

**모노레포**: pnpm workspace (`pnpm-workspace.yaml`)

## 기술 스택

| 영역 | 기술 |
|------|------|
| Runtime | Node.js 22, TypeScript 5.x |
| Bot | discord.js v14, feedsmith (RSS 파서), pg-boss (PostgreSQL 잡 큐) |
| Web | Next.js 16 App Router, React 19, shadcn/ui, Tailwind CSS v4, Tiptap (리치 에디터) |
| DB | Supabase PostgreSQL + Drizzle ORM (Transaction Pooler, `prepare: false`) |
| Auth | Supabase Auth (Discord OAuth) + `@supabase/ssr` |
| 배포 | AWS EC2 (bot), Vercel (web), Supabase (DB + Auth) |

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

## 핵심 파일 위치

| 파일 | 설명 |
|------|------|
| `packages/shared/src/db/schema.ts` | 전체 DB 스키마 (Drizzle) |
| `packages/shared/src/db/index.ts` | DB 연결 (Transaction Pooler, `prepare: false`) |
| `packages/web/src/lib/supabase/client.ts` | 브라우저용 Supabase 클라이언트 |
| `packages/web/src/lib/supabase/server.ts` | 서버용 Supabase 클라이언트 (cookies) |
| `packages/web/src/lib/supabase/middleware.ts` | 미들웨어용 세션 갱신 |
| `packages/web/middleware.ts` | 라우트 보호 (protected/admin/auth) |
| `packages/web/src/app/auth/callback/route.ts` | OAuth 콜백 + 상태별 리다이렉트 |
| `packages/web/src/lib/admin.ts` | 관리자 권한 체크 (`withAdminAuth`) |
| `packages/web/src/lib/member-config.ts` | 멤버 상태별 라벨/뱃지 설정 |
| `packages/web/src/lib/rss-detect.ts` | 블로그 URL → RSS URL 자동 감지 |
| `packages/web/src/app/(user)/layout.tsx` | 사용자 레이아웃 (상태 체크 + 리다이렉트) |
| `packages/web/src/app/` | Next.js 페이지/라우트 |
| `packages/bot/src/bot.ts` | Discord 클라이언트 초기화 (이벤트 핸들러만) |
| `packages/bot/src/job-queue.ts` | pg-boss 싱글톤 (시작/종료/조회) |
| `packages/bot/src/scheduler-registry.ts` | 잡 등록 + RSS→Post→Notification 파이프라인 |
| `packages/bot/src/services/score.service.ts` | 활동 점수 계산/부여 |
| `packages/web/src/lib/board-auth.ts` | 게시판 인증 헬퍼 (`getBoardAuth`) |
| `packages/web/src/lib/board-config.ts` | 게시판 카테고리/뱃지 설정 |
| `packages/web/src/lib/api-error.ts` | API 표준 응답/에러 헬퍼 (`successResponse`, `Errors`) |
| `packages/web/src/components/ui/member-avatar.tsx` | 재사용 아바타 컴포넌트 (링크+관리자뱃지) |
| `packages/web/src/components/board/tiptap-editor.tsx` | Tiptap 리치 에디터 (코드블록 언어선택, 링크 다이얼로그) |
| `packages/web/src/components/layout/bottom-nav.tsx` | 모바일 하단 탭 바 (사용자 5개 / 관리자 6개) |
| `packages/web/src/components/layout/notice-banner.tsx` | 글로벌 공지 배너 (접기/닫기, localStorage 상태) |
| `packages/web/src/components/layout/pull-to-refresh.tsx` | Pull-to-Refresh 컴포넌트 (PWA 터치 제스처) |
| `packages/web/src/hooks/use-pull-to-refresh.ts` | Pull-to-Refresh 훅 (커스텀 터치 핸들링) |
| `packages/web/src/app/api/notice-banner/route.ts` | 활성 공지 배너 조회 API |
| `packages/web/src/app/(admin)/admin/rounds/page.tsx` | 회차 관리 페이지 (CRUD + 현재 회차 설정) |
| `packages/web/src/app/api/profile/withdraw/route.ts` | 유저 자체 탈퇴 API |
| `packages/bot/src/scripts/rss-collect.ts` | 수동 RSS 수집 스크립트 (봇 없이 독립 실행) |
| `packages/bot/src/scripts/setup-channels.ts` | 디스코드 채널 일괄 생성 스크립트 |
| `packages/bot/src/scripts/list-channels.ts` | 서버 채널 구조 조회 스크립트 |
| `packages/bot/src/services/round.service.ts` | 회차 관리 + ConfigKeys (announcement/notice/curation 채널) |

## 인증 구조

- **웹**: Supabase Auth → Discord OAuth → `user.identities[].id` (Discord ID) → `members.discord_id` 매칭
- **봇**: `service_role` key로 직접 DB 접근 (스케줄러/이벤트 핸들러 전용, 슬래시 커맨드 없음)
- **미들웨어**: `@supabase/ssr`의 `updateSession()`으로 세션 자동 갱신
- **관리자**: `ADMIN_DISCORD_IDS` 환경변수로 Discord ID 기반 권한 체크
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
- **레이아웃**: 데스크톱 사이드바 + 모바일 하단 탭 바 (사용자/관리자 분리)
- **공지 배너**: 글로벌 상단 배너 (관리자가 공지 글에서 활성화, 1개만 노출)
- **Pull-to-Refresh**: 커스텀 터치 제스처 기반 새로고침 (Safari PWA 최적화)
- **PWA**: 홈 화면 추가 지원 (manifest.json, 서비스 워커 없음)
- **랜딩 페이지**: 인증 유저 자동 리다이렉트 (`/` → `/dashboard`)
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

## docs 파일명 컨벤션

`yy-mm-dd-{설명}.md` — 예: `26-03-03-system-architecture.md`
- 설명은 다른 문서와 구분될 정도로 구체적으로 작명
- `docs/plans/` 하위도 동일 컨벤션 적용
- 단, `docs/ARCHITECTURE.md`는 제외하며 업데이트 시에도 네이밍을 그대로 유지
