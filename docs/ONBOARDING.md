# Onboarding Guide

이 문서는 프로젝트에 빠르게 합류하기 위한 가이드입니다.

---

## 프로젝트 한 줄 요약

**웹 대시보드(Next.js) + Discord 봇(discord.js)** 으로 블로그 스터디를 자동화하는 모노레포.
멤버 RSS를 자동 수집하고, 출석/벌금/점수를 관리하며, 큐레이션 콘텐츠를 공유합니다.

```
Discord Server ←→ Bot (discord.js + pg-boss) ←→ PostgreSQL (Supabase)
                                                        ↑
Web Dashboard (Next.js 16) ←→ Supabase Auth + DB ──────┘
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Runtime | Node.js 22, TypeScript strict, pnpm workspace |
| Web | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| Bot | discord.js v14, pg-boss (잡 큐), feedsmith (RSS) |
| DB | Supabase PostgreSQL + Drizzle ORM |
| Auth | Supabase Auth (Discord OAuth) |
| 배포 | Vercel (web), AWS EC2 (bot), Supabase (DB+Auth) |

## 문서 맵

자세한 내용은 각 문서를 참조하세요.

| 문서 | 내용 |
|------|------|
| [`CLAUDE.md`](../CLAUDE.md) | 프로젝트 규칙, 컨벤션, 핵심 파일 위치 (Claude Code 사용 시 자동 로드) |
| [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | 시스템 아키텍처 (Mermaid 다이어그램) |
| [`docs/26-03-06-tech-decisions.md`](./26-03-06-tech-decisions.md) | 기술 선택 근거 (ADR) |
| [`docs/26-03-06-ui-design-system.md`](./26-03-06-ui-design-system.md) | UI 디자인 시스템 스펙 |
| [`docs/26-03-06-development.md`](./26-03-06-development.md) | 개발 환경 상세 설정 (Discord 봇 생성, Supabase 설정 등) |
| [`docs/26-03-06-schema-summary.md`](./26-03-06-schema-summary.md) | DB 스키마 요약 |
| [`docs/26-03-06-patterns.md`](./26-03-06-patterns.md) | API 패턴, 코드 규칙 |
| [`docs/26-03-06-checklist.md`](./26-03-06-checklist.md) | 구현 체크리스트 (진행 상황) |

---

## 로컬 개발 환경 세팅

### 1. 사전 요구사항

- Node.js 22+
- pnpm 8+ (`npm install -g pnpm`)
- Git

### 2. 프로젝트 클론 및 설치

```bash
git clone <repo-url>
cd study-admin
pnpm install
```

### 3. 환경 변수 설정

`.env.local` 파일을 **2곳**에 배치해야 합니다 (파일은 별도 전달받음).

```
study-admin/.env.local              ← 루트 (shared, bot용)
study-admin/packages/web/.env.local ← Next.js용 (동일 내용)
```

> Next.js는 자기 패키지 디렉토리 기준으로 env를 읽기 때문에 두 곳 모두 필요합니다.

**주요 환경 변수 목록:**

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 클라이언트 공개 키 |
| `SUPABASE_SERVICE_KEY` | Supabase 서버용 비밀 키 |
| `DATABASE_URL` | PostgreSQL Transaction Pooler URL |
| `DISCORD_TOKEN` | Discord 봇 토큰 |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord OAuth |
| `DISCORD_GUILD_ID` | 스터디 Discord 서버 ID |
| `ADMIN_DISCORD_IDS` | 관리자 Discord ID (쉼표 구분) |

### 4. 빌드 및 실행

```bash
# shared 패키지 먼저 빌드 (web, bot이 의존)
pnpm --filter @blog-study/shared build

# 웹 개발 서버 (localhost:3300)
pnpm dev:web

# 봇 개발 서버 (별도 터미널)
pnpm dev:bot
```

### 5. 검증

```bash
pnpm build        # 전체 빌드 확인
pnpm typecheck    # 타입 체크
pnpm lint         # ESLint
pnpm test         # 테스트 (Vitest)
```

---

## 프로젝트 구조

```
packages/
├── shared/   # 공유 코드 — DB 스키마(Drizzle), 타입, 유틸
├── web/      # Next.js 16 대시보드 — Vercel 배포
└── bot/      # Discord 봇 — AWS EC2 배포
```

### shared (공유 패키지)

web과 bot이 공통으로 사용하는 코드. **스키마 변경 시 반드시 리빌드** 필요.

```bash
pnpm --filter @blog-study/shared build
```

- `src/db/schema.ts` — 전체 DB 스키마 (12개 테이블)
- `src/db/index.ts` — DB 연결 (Transaction Pooler, `prepare: false`)

---

## 현재 구현 상태 (완료된 기능)

### Web — 사용자 페이지 (전체 완료)

| 페이지 | 경로 | 기능 |
|--------|------|------|
| 랜딩 | `/` | 스터디 소개 + 로그인 유도 (추후 수정 예정) |
| 로그인 | `/login` | Discord OAuth 로그인 |
| 대시보드 | `/dashboard` | 현재 회차, 내 출석, 최근 글 |
| 글 목록 | `/posts` | 스터디원 블로그 글 + 수동 등록 + 페이지네이션 |
| 랭킹 | `/ranking` | 포디움, 정렬(총점/포스트/활동), 출석 히트맵 |
| 큐레이션 | `/curation` | 추천/최신 정렬, 카테고리/태그 필터, 무한 스크롤 |
| 게시판 | `/board` | 카테고리별 게시글 + 중첩 댓글 + Tiptap 에디터 |
| 멤버 목록 | `/members` | 활동 멤버 그리드 |
| 멤버 프로필 | `/members/[id]` | 상세 프로필 + 활동 통계 |
| 내 프로필 | `/profile` | 조회/수정 |
| 온보딩 | `/profile/onboarding` | 최초 가입 시 블로그 URL, 관심사, 자기소개 설정 |

### Web — 관리자 페이지 (부분 완료)

| 페이지 | 경로 | 상태 |
|--------|------|------|
| 대시보드 | `/admin` | 완료 |
| 멤버 관리 | `/admin/members` | 완료 (CRUD + 승인 + 상태) |
| 회차 관리 | `/admin/rounds` | 완료 (CRUD + 현재 회차 설정) |
| 큐레이션 소스 | `/admin/curation` | 완료 (소스 관리 + 크롤링) |
| 출석 관리 | `/admin/attendance` | UI 있음, **검증 필요** |
| 벌금 관리 | `/admin/fines` | UI 있음, **검증 필요** |
| 점수 관리 | `/admin/scores` | UI 있음, **검증 필요** |
| 설정 | `/admin/settings` | UI 있음, **검증 필요** |

### Web — API (38개 엔드포인트)

주요 패턴: `packages/web/src/app/api/` 하위. 상세 목록은 코드 참조.

### Bot — 상세 구조

봇은 크게 **스케줄러 (pg-boss cron)** + **이벤트 핸들러 (실시간)** + **서비스 레이어**로 나뉩니다.

#### 스케줄러 (pg-boss 기반)

모든 cron 잡은 `scheduler-registry.ts`에서 등록. 시간은 KST 기준.

| 잡 | 스케줄 (KST) | 기능 |
|----|-------------|------|
| `rss-poll` | 5분마다 | 멤버 RSS 수집 → 글 저장 → 점수 부여 |
| `attendance-check` | 회차 종료일 자정 | 출석 체크 (이미 출석인 유저 제외, 나머지 지각/결석 판정) |
| `fine-reminder` | 매일 09:00 | 미납 벌금 DM 알림 |
| `round-report` | 매주 월 10:00 | 지난 회차 요약 리포트 → Discord 공지 채널 |
| `round-start` | 회차 시작일 | 새 회차 시작 공지 → Discord 공지 채널 (회차는 웹 admin에서 수동 생성) |
| `curation-crawl` | 매일 07:00 | 등록된 큐레이션 소스의 RSS 크롤링 → DB 저장 |
| `curation-share` | 매일 08:30 | 크롤링된 아이템 중 미공유 건 → #큐레이션 채널 공유 |

> cron 표현식은 `scheduler-registry.ts`의 `JOB_DEFINITIONS` 배열에서 관리.
> pg-boss가 PostgreSQL 테이블로 잡을 관리하므로 봇 재시작 시에도 스케줄 유지.

#### 스케줄러 파이프라인 상세

**RSS 수집 파이프라인** (`rss-poll`):
```
활성 멤버 RSS 피드 순회
  → feedsmith로 RSS 파싱
  → 2025-07-01 이후 글만 필터
  → PostService.create()로 DB 저장 (중복 URL 체크)
  → 신규 글이면:
      → ScoreService.grantScore(BLOG_POST, +30점)
      → NotificationService로 Discord 공지
```

**출석 체크 파이프라인** (`attendance-check`):
```
현재 회차의 멤버별 attendance 레코드 조회
  → 이미 'submitted' 상태인 멤버는 스킵
  → 기한 내 글 있으면 → 'submitted'
  → 유예 기간 내 글 있으면 → 'late' + 벌금 생성
  → 글 없으면 → 'absent' + 벌금 생성
```

**벌금 DM 파이프라인** (`fine-reminder`):
```
미납(unpaid) 벌금 조회
  → 각 멤버에게 DM 발송 (금액, 사유, 경과일)
  → pendingConfirmations에 등록
  → 멤버가 "납부완료"/"done" 등 DM 답장 시 → DM Handler가 markPaid() 처리
```

**큐레이션 파이프라인** (`curation-crawl` → `curation-share`):
```
[07:00] 활성 소스의 RSS URL 순회 → feedsmith 파싱 → DB 저장 (중복 URL 체크)
[08:30] 미공유(isShared=false) 아이템 중 상위 N건 → Discord #큐레이션 채널 공유 → isShared=true
```

#### 이벤트 핸들러 (실시간)

봇이 Discord 서버에서 실시간으로 감지하는 이벤트들입니다.

**Activity Handler** (`handlers/activity-handler.ts`):
Discord 활동을 감지해서 자동으로 점수를 부여합니다.

| 이벤트 | 조건 | 점수 |
|--------|------|------|
| `MessageCreate` (채널) | 10자 이상, 봇 아님, 스터디원 | +2 (DISCORD_MESSAGE) |
| `MessageCreate` (스레드) | 10자 이상, 봇 아님, 스터디원 | +3 (DISCORD_THREAD) |
| `MessageReactionAdd` | 봇 아님, 자기 글 아님, 스터디원 | +1 (DISCORD_REACTION) |

- Discord ID → `members.discord_id` 매칭으로 스터디원 여부 확인
- 일일 상한 초과 시 점수 미부여 (원자적 CTE 쿼리로 race condition 방지)

**DM Handler** (`handlers/dm-handler.ts`):
벌금 납부 확인을 위한 DM 대화 처리입니다.

```
봇이 벌금 DM 발송 → pendingConfirmations Map에 등록
  → 사용자가 DM으로 "납부완료", "완료", "done", "paid", "yes" 답장
  → isPaymentConfirmation() 체크
  → FineService.markPaid() → fine 상태를 'paid'로 변경
  → 확인 메시지 DM 답장
```

#### 서비스 레이어

| 서비스 | 파일 | 역할 |
|--------|------|------|
| `ScoreService` | `services/score.service.ts` | 점수 부여/조회 (일일 상한 관리, 원자적 CTE) |
| `PostService` | `services/post.service.ts` | 블로그 글 CRUD (중복 체크) |
| `RssService` | `services/rss.service.ts` | feedsmith 기반 RSS 파싱 |
| `AttendanceService` | `services/attendance.service.ts` | 출석 판정 로직 |
| `FineService` | `services/fine.service.ts` | 벌금 생성/조회/납부 처리 |
| `NotificationService` | `services/notification.service.ts` | Discord 채널/DM 메시지 발송 |
| `CurationService` | `services/curation.service.ts` | 큐레이션 크롤링/공유 |
| `RoundService` | `services/round.service.ts` | 회차 조회 |
| `MemberService` | `services/member.service.ts` | 멤버 조회 |

> 모든 서비스는 싱글톤 패턴 (`getXxxService()` 팩토리 함수)

### 인증 플로우

```
사용자 → Discord OAuth 로그인 → Supabase Auth → /auth/callback
  → Discord ID로 members 테이블 매칭
  → 상태별 리다이렉트:
     - 첫 가입 → /profile/onboarding
     - pending_approval → /pending (승인 대기)
     - active/dormant/ob → /dashboard
     - inactive → /inactive
```

### 활동 점수 시스템

| 활동 | 점수 | 일일 상한 |
|------|------|-----------|
| 블로그 글 발행 | +30 | 60 (2건) |
| Discord 메시지 (10자+) | +2 | 10 (5건) |
| Discord 스레드 답글 | +3 | 9 (3건) |
| Discord 리액션 | +1 | 5 (5건) |
| 글 조회 | +2 | 10 (5건) |
| 관리자 수동 부여 | 가변 | 없음 |

---

## 남은 작업

### Web 파트

#### 우선순위 높음
- [ ] 관리자 페이지 검증 — 출석(`/admin/attendance`), 벌금(`/admin/fines`), 점수(`/admin/scores`), 설정(`/admin/settings`) 실제 동작 확인 및 버그 수정
- [ ] `globals.css` 컬러 토큰 재정의 — 스카이블루 포인트 컬러 반영

#### 배포 관련
- [ ] Vercel 배포 설정 (환경 변수, 도메인)
- [ ] Supabase RLS 정책 설정 (Row Level Security)
- [ ] Supabase 프로덕션 Discord OAuth 설정

#### 개선 예정 (plans/ 문서 참조)
- [ ] 큐레이션 UI 리디자인 — 썸네일+설명 표시, 무한 스크롤 개선 → [`docs/plans/26-03-01-curation-redesign-design.md`](./plans/26-03-01-curation-redesign-design.md)
- [ ] 랭킹 게이미피케이션 강화 → [`docs/plans/26-02-26-ranking-gamification-design.md`](./plans/26-02-26-ranking-gamification-design.md)
- [ ] Supabase Realtime 통합 (실시간 활동 피드, 대시보드 갱신) — 선택적

### Bot 파트

#### 스케줄 시간 변경 (코드 반영 필요)
현재 코드의 cron과 실제 운영 시간이 다릅니다. `scheduler-registry.ts`의 `JOB_DEFINITIONS` 수정 필요:

| 잡 | 현재 코드 | 변경 목표 (KST) | cron (UTC) |
|----|----------|----------------|------------|
| `attendance-check` | `0 0 * * 2` | 회차 종료일 자정 | 동적 or `0 15 * * *` (주의) |
| `fine-reminder` | `0 10 * * *` | 매일 09:00 | `0 0 * * *` |
| `round-report` | `5 0 * * 2` | 매주 월 10:00 | `0 1 * * 1` |
| `curation-crawl` | `0 23 * * *` | 매일 07:00 | `0 22 * * *` (전날 UTC) |
| `curation-share` | `0 10 * * *` | 매일 08:30 | `30 23 * * *` (전날 UTC) |

> `attendance-check`는 회차 종료 시간에 맞춰야 하므로 동적 스케줄링 또는 매일 실행 + 코드 내 날짜 체크 방식 검토 필요

#### 우선순위 높음
- [ ] 위 스케줄 시간 변경 코드 반영
- [ ] AWS EC2 배포 설정 (환경 변수, PM2/systemd 프로세스 관리)
- [ ] 봇 + pg-boss 안정성 검증 (장시간 운영 테스트, 메모리 누수 확인)

#### E2E 파이프라인 검증
- [ ] RSS 수집 → 글 저장 → 점수 부여 → Discord 알림 전체 흐름
- [ ] 출석 체크 → 지각/결석 판정 → 벌금 자동 생성 흐름
- [ ] 벌금 DM 발송 → 사용자 "납부완료" 답장 → markPaid 흐름
- [ ] 회차 시작 공지 + 회차 리포트 발송 검증
- [ ] 큐레이션 크롤링 → DB 저장 → Discord 공유 흐름
- [ ] Activity Handler: 메시지/스레드/리액션 점수 부여 + 일일 상한 동작 확인

#### 개선 예정
- [ ] DM 핸들러 기능 확장 (현재 벌금 납부만 처리, 더 다양한 DM 대화 지원 가능)
- [ ] 에러 핸들링/재시도 로직 강화 (RSS 파싱 실패, Discord API rate limit 등)
- [ ] 알림 메시지 템플릿 개선 (Embed 리치 메시지 등)

### 공통

- [ ] E2E 수동 테스트 — 웹 로그인 → 온보딩 → 대시보드 → 글 확인 전체 플로우
- [ ] 프로덕션 환경 변수 정리 및 시크릿 관리

---

## 코딩 컨벤션 요약

| 항목 | 규칙 |
|------|------|
| 네이밍 | camelCase (변수/함수), PascalCase (컴포넌트/타입), kebab-case (파일명) |
| DB 컬럼 | snake_case |
| 커밋 | `git log` 스타일 따름, `Co-Authored-By: Claude <noreply@anthropic.com>` 포함 |
| git add | `git add -A` 금지 → 변경 파일만 명시적 추가 |
| 다이얼로그 | `window.confirm/alert/prompt` 금지 → 커스텀 다이얼로그 사용 |
| Drizzle 마이그레이션 | `packages/shared/drizzle/*.sql`은 로컬 전용, 커밋 금지 |

상세 패턴은 [`docs/26-03-06-patterns.md`](./26-03-06-patterns.md) 참조.

## DB 스키마 변경 시

```bash
# 1. schema.ts 수정 후
cd packages/shared
export $(grep DATABASE_URL ../../.env.local | head -1 | xargs)
npx drizzle-kit push --force

# 2. shared 리빌드
pnpm --filter @blog-study/shared build
```

---

## Claude Code 사용 시

이 프로젝트는 `CLAUDE.md`에 상세한 규칙이 정의되어 있어, Claude Code가 자동으로 프로젝트 컨텍스트를 이해합니다.

```bash
# Claude Code 시작 시 자동 로드되는 것:
# - CLAUDE.md (프로젝트 규칙, 핵심 파일 위치, 컨벤션)
# - 글로벌 설정 (~/.claude/CLAUDE.md)
```

**유용한 커맨드:**

| 커맨드 | 설명 |
|--------|------|
| `/safe-commit` | 변경 파일만 명시적으로 add 후 커밋 |
| `/pr` | PR 생성 |
| `/review` | 코드 리뷰 |
| `/test` | 테스트 작성 |
| `/handoff` | 현재 작업 내용 인수인계 문서 생성 |
