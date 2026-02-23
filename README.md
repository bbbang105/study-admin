# Study Admin

블로그 스터디 운영 자동화 플랫폼. Discord 봇 + 웹 대시보드.

## 구조

```
packages/
  bot/      Discord 봇 (discord.js, pg-boss, Railway 배포)
  web/      Next.js 대시보드 (Vercel 배포)
  shared/   DB 스키마, 타입, 유틸리티 (Drizzle ORM)
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14, React 18, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Supabase |
| Bot | discord.js v14, pg-boss |
| DB | PostgreSQL (Supabase), Drizzle ORM, pgvector |
| AI | OpenAI GPT-4o-mini, text-embedding-3-small |
| Deploy | Vercel (Web), Railway (Bot), Supabase (DB) |

## 주요 기능

- **RSS 자동 수집** — 블로그 글 발행 감지 및 수집
- **AI 요약 & 추천** — GPT 기반 글 요약, 키워드 추출, 유사 글 추천
- **출석 자동화** — 2주 1회차, 지각/결석 자동 판정
- **벌금 관리** — 자동 부과, DM 알림, 납부 확인
- **랭킹 & 통계** — 포스트 수, 출석률 기반 실시간 랭킹
- **큐레이션** — 관심 키워드 기반 컨퍼런스/아티클 추천

## 시작하기

```bash
# 의존성 설치
pnpm install

# 웹 개발 서버
pnpm dev:web

# 봇 개발 서버
pnpm dev:bot

# 전체 빌드
pnpm build

# 타입 체크
pnpm typecheck
```

## 환경 변수

`.env.example` 참조.

## 문서

- [아키텍처](docs/ARCHITECTURE.md)
- [기술 결정](docs/TECH-DECISIONS.md)
- [UI 디자인 시스템](docs/UI-DESIGN-SYSTEM.md)
- [개발 환경](docs/DEVELOPMENT.md)
- [구현 체크리스트](docs/CHECKLIST.md)
