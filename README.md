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
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| Backend | Next.js API Routes, Supabase |
| Bot | discord.js v14, pg-boss |
| DB | PostgreSQL (Supabase), Drizzle ORM |
| Deploy | Vercel (Web), AWS EC2 (Bot), Supabase (DB) |

## 주요 기능

- **RSS 자동 수집** — 블로그 글 발행 감지 및 수집
- **출석 자동화** — 2주 1회차, 지각/결석 자동 판정
- **벌금 관리** — 자동 부과, DM 알림, 납부 확인
- **활동 점수 & 랭킹** — 포스트 수, 출석률, 활동 기반 실시간 랭킹
- **큐레이션** — 태그 + 관심 키워드 기반 컨퍼런스/아티클 추천
- **커뮤니티 게시판** — 공지/일반/자유 게시글 + 댓글

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
- [기술 결정](docs/26-03-06-tech-decisions.md)
- [UI 디자인 시스템](docs/26-03-06-ui-design-system.md)
- [개발 환경](docs/26-03-06-development.md)
- [구현 체크리스트](docs/26-03-06-checklist.md)
