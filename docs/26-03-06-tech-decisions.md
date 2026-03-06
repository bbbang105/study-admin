# 기술 결정 기록 (ADR)

## 결정 요약

| # | 결정 | 선택 | 대안 | 이유 |
|---|------|------|------|------|
| 1 | Next.js 버전 | **16** | 14 유지, 15 | React 19, Tailwind v4 네이티브 지원 |
| 2 | 인증 | **Supabase Auth** | 커스텀 JWT | Discord OAuth 네이티브, 유지보수 비용 제거 |
| 3 | RSS 파서 | **feedsmith** | rss-parser | rss-parser 3년 미유지보수, feedsmith 활발 |
| 4 | 작업 큐 | **pg-boss** | node-cron, Upstash Redis | 추가 인프라 불필요, PostgreSQL 기반 트랜잭션 |
| 5 | 실시간 | **Supabase Realtime** (선택적) | WebSocket 직접 구현 | 활동 피드만 적용, 20줄로 구현 가능 |

---

## ADR-1: Next.js 16 업그레이드

**상태**: ✅ 구현 완료 (PR #5)

**결정**: Next.js 14 → 16 업그레이드 (React 19, Tailwind CSS v4 포함)

**근거**:
- React 19: 서버 컴포넌트/액션 안정화
- Tailwind CSS v4: 네이티브 CSS 기반, 빌드 성능 향상
- Turbopack 안정화: 빌드/HMR 성능 개선

**마이그레이션 내용**:
- `params`/`cookies()`/`headers()` async 변환
- Tailwind v4 설정 마이그레이션 (PostCSS 기반)
- React 18 → 19 호환성 업데이트

---

## ADR-2: Supabase Auth로 전환

**상태**: ✅ 구현 완료 (PR #2)

**결정**: 커스텀 이메일/JWT 인증 → Supabase Auth (Discord OAuth)

**근거**:
- Discord OAuth2 네이티브 지원 (콜백 URL 자동 관리)
- JWT, 세션, 토큰 리프레시 코드 전부 삭제 가능
- RLS 정책 활용 가능
- 무료 50,000 MAU (스터디 규모에 충분)

**아키텍처 분리**:
- 웹: Supabase Auth (Discord OAuth2 PKCE 플로우)
- 봇: `service_role` 키 + Discord ID로 직접 DB 조회/수정
- 봇은 Auth 레이어 무관

**구현 내용**:
- `@supabase/ssr` 기반 SSR 클라이언트 (client/server/middleware)
- Discord ID 추출: `user.identities[].id` where `provider === 'discord'`
- 미들웨어: `updateSession()`으로 세션 자동 갱신 + 라우트 보호
- 관리자: `ADMIN_DISCORD_IDS` 환경변수로 Discord ID 기반 권한 체크
- DB: Transaction Pooler 사용 (`prepare: false`)

**제거 완료**:
- `users`, `sessions` 테이블 (Supabase Auth의 `auth.users`로 대체)
- `packages/web/src/lib/auth.ts` (커스텀 JWT 로직)
- `packages/web/src/lib/email.ts` (이메일 인증)
- `bcryptjs`, `jsonwebtoken`, `jose`, `resend` 의존성
- 회원가입/이메일인증 페이지 및 API

---

## ADR-3: feedsmith 채택

**상태**: ✅ 구현 완료

**결정**: rss-parser → feedsmith

**근거**:
- rss-parser: 마지막 배포 3년 전, 비활성
- feedsmith: 2025 활발, RSS/Atom/RDF/JSON Feed 모두 지원
- 피드 생성 기능도 있어 향후 RSS 피드 노출 가능
- rss-parser보다 빠름

**구현 내용**:
- `RssService`: axios fetch + `parseFeed()` 분리 구조
- `extractFeedItems()` 헬퍼로 RSS/Atom/JSON/RDF 전체 포맷 정규화
- `detectRssUrl()`, `fetchFeed()` 모두 feedsmith 기반으로 전환

---

## ADR-4: pg-boss로 작업 큐 전환

**상태**: ✅ 구현 완료

**결정**: node-cron → pg-boss

**근거**:
- node-cron: 프로세스 내 메모리 기반, 재시작 시 상태 유실
- pg-boss: PostgreSQL 기반, 트랜잭션 보장, 재시도/동시성 관리
- Upstash Redis 불필요: 추가 인프라, 커맨드당 과금, BullMQ 호환 문제

**구현 내용**:
- `job-queue.ts`: pg-boss 싱글톤 (start/stop/get)
- `scheduler-registry.ts`: 6개 cron 잡 등록 + 워커 연결
- `index.ts`에서 pg-boss 시작 → 잡 등록 → graceful shutdown 통합
- `DATABASE_URL_DIRECT` 환경변수 추가 (pg-boss LISTEN/NOTIFY용)

**등록된 잡**:
| 잡 이름 | cron | 핸들러 |
|---------|------|--------|
| `rss-poll` | `*/5 * * * *` | `RssPoller.poll()` |
| `attendance-check` | `0 0 * * 2` | `AttendanceChecker.check()` |
| `fine-reminder` | `0 10 * * *` | `FineReminder.sendReminders()` |
| `round-report` | `5 0 * * 2` | `RoundReporter.sendRoundReport()` |
| `curation-crawl` | `0 9 * * *` | `CurationCrawler.crawl()` |
| `curation-share` | `0 10 * * *` | `CurationCrawler.shareDailyContent()` |

---

## 비용 총 요약

| 서비스 | 월 비용 |
|--------|--------|
| AWS EC2 (Bot) | 기존 서버 활용 |
| Vercel (Web) | $0 (무료) |
| Supabase (DB + Auth) | $0 (무료) ~ $25 (Pro) |
| **합계** | **$0 ~ $25/월** |
