# 개발 환경 설정

## 사전 요구사항

- Node.js 22 이상
- pnpm 8 이상 (`npm install -g pnpm`)
- Discord 개발자 계정 ([discord.com/developers](https://discord.com/developers/applications))
- Supabase 프로젝트 ([supabase.com](https://supabase.com))

## 초기 설정

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경 변수 설정
cp .env.example .env.local
cp .env.example packages/web/.env.local
# 두 파일 모두 값을 채워야 합니다 (Next.js는 packages/web/ 기준으로 읽음)

# 3. shared 패키지 빌드 (web/bot이 의존)
pnpm --filter @blog-study/shared build

# 4. DB 스키마 푸시
DATABASE_URL="your-connection-string" pnpm --filter @blog-study/shared db:push

# 5. 스터디 회차 초기화
pnpm --filter @blog-study/bot init-rounds

# 6. Discord 슬래시 커맨드 등록
pnpm --filter @blog-study/bot deploy-commands
```

## 개발 서버

```bash
# 봇과 웹을 각각 별도 터미널에서 실행
pnpm dev:bot          # 봇 (tsx watch)
pnpm dev:web          # 웹 (localhost:3000)

# 포트 지정
pnpm --filter @blog-study/web dev --port 3200
```

## 환경 변수

루트 `.env.local`과 `packages/web/.env.local` 두 곳에 동일하게 설정 필요.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=                # 프로젝트 URL (https://xxx.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=           # 클라이언트용 공개 키
SUPABASE_SERVICE_KEY=                    # 서버용 비밀 키
DATABASE_URL=                            # Transaction Pooler URL
                                         # postgresql://postgres.xxx:[password]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres

# Discord
DISCORD_TOKEN=                           # 봇 토큰
DISCORD_CLIENT_ID=                       # 클라이언트 ID
DISCORD_CLIENT_SECRET=                   # 클라이언트 시크릿 (OAuth용)
DISCORD_GUILD_ID=                        # 서버(길드) ID

# Admin
ADMIN_DISCORD_IDS=id1,id2               # 관리자 Discord User ID (쉼표 구분)

# Application
APP_URL=http://localhost:3000            # 웹 URL
NODE_ENV=development

# Study Config
STUDY_START_DATE=2024-01-01              # 스터디 시작일
TOTAL_ROUNDS=10                          # 총 회차 수
```

### 환경변수 주의사항

- `NEXT_PUBLIC_` 접두사가 있는 변수만 브라우저에 노출됨
- `packages/web/.env.local`이 없으면 Next.js가 환경변수를 읽지 못함
- `DATABASE_URL`은 **Transaction Pooler** URL 사용 (Direct connection은 DNS 미지원 가능)

## 테스트

```bash
# 전체 테스트
pnpm test

# 패키지별
pnpm --filter @blog-study/bot test
pnpm --filter @blog-study/shared test

# 워치 모드
pnpm --filter @blog-study/bot test:watch
```

## 빌드

```bash
# 전체 빌드 (shared → bot/web 순서)
pnpm build

# 패키지별
pnpm build:bot        # tsup으로 번들링 → dist/
pnpm build:web        # next build
```

## 코드 품질

```bash
pnpm lint             # ESLint
pnpm format           # Prettier (자동 수정)
pnpm format:check     # Prettier (검사만)
pnpm typecheck        # TypeScript 타입 체크
```

## Supabase 설정

### Discord OAuth 프로바이더
1. Supabase Dashboard → Authentication → Providers → Discord
2. `DISCORD_CLIENT_ID`와 `DISCORD_CLIENT_SECRET` 입력
3. Callback URL을 Discord Developer Portal에 등록

### Redirect URL 설정
1. Supabase Dashboard → Authentication → URL Configuration
2. Redirect URLs에 추가:
   - `http://localhost:3000/auth/callback` (로컬)
   - `http://localhost:3200/auth/callback` (로컬 대체 포트)
   - `https://your-domain.vercel.app/auth/callback` (프로덕션)

### pg-boss 설정
pg-boss는 첫 실행 시 자동으로 필요한 테이블을 생성합니다.

## Discord 봇 설정

### 1. 봇 생성
1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. "New Application" → 이름 입력
3. "Bot" 탭 → "Add Bot"
4. Token 복사 → `DISCORD_TOKEN`에 입력
5. **Privileged Gateway Intents** 모두 활성화:
   - PRESENCE INTENT
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT

### 2. OAuth2 설정
1. "OAuth2" → "General"
2. Redirects에 Supabase 콜백 URL 추가
3. Client Secret 복사 → `DISCORD_CLIENT_SECRET`에 입력

### 3. 봇 초대
1. "OAuth2" → "URL Generator"
2. Scopes: `bot`, `applications.commands`
3. Bot Permissions: `Send Messages`, `Manage Roles`, `Embed Links`, `Add Reactions`, `Use Slash Commands`
4. 생성된 URL로 서버에 초대

## 프로젝트 구조

```
study-admin/
├── CLAUDE.md                 # Claude Code 프로젝트 설정
├── .env.example              # 환경 변수 템플릿
├── .env.local                # 로컬 환경 변수 (gitignored)
├── package.json              # 루트 패키지 (스크립트)
├── pnpm-workspace.yaml       # 모노레포 설정
├── tsconfig.json             # 공통 TypeScript 설정
├── vercel.json               # Vercel 배포 설정
├── docs/                     # 프로젝트 문서
│   ├── ARCHITECTURE.md       # 시스템 아키텍처
│   ├── TECH-DECISIONS.md     # 기술 선택 근거 (ADR)
│   ├── UI-DESIGN-SYSTEM.md   # UI 디자인 시스템
│   ├── DEVELOPMENT.md        # (이 파일)
│   └── CHECKLIST.md          # 구현 체크리스트
└── packages/
    ├── bot/                  # Discord 봇
    │   ├── src/
    │   │   ├── index.ts      # 엔트리포인트
    │   │   ├── bot.ts        # Discord 클라이언트
    │   │   ├── commands/     # 슬래시 커맨드
    │   │   ├── services/     # 비즈니스 로직
    │   │   ├── schedulers/   # 크론/잡 큐
    │   │   ├── handlers/     # 이벤트 핸들러
    │   │   └── scripts/      # 초기화 스크립트
    │   └── package.json
    ├── web/                  # Next.js 대시보드
    │   ├── .env.local        # 웹 전용 환경 변수 (gitignored)
    │   ├── middleware.ts     # 라우트 보호 미들웨어
    │   ├── src/
    │   │   ├── app/          # App Router 페이지
    │   │   │   ├── auth/callback/  # OAuth 콜백
    │   │   │   ├── (auth)/   # 로그인 페이지
    │   │   │   ├── (user)/   # 사용자 페이지
    │   │   │   └── (admin)/  # 관리자 페이지
    │   │   ├── components/   # UI 컴포넌트 (shadcn/ui)
    │   │   └── lib/          # 유틸리티
    │   │       ├── supabase/ # Supabase 클라이언트 (client/server/middleware)
    │   │       ├── admin.ts  # 관리자 권한
    │   │       ├── db.ts     # DB 연결
    │   │       └── api-error.ts # API 에러 처리
    │   └── package.json
    └── shared/               # 공유 코드
        ├── src/
        │   ├── db/           # Drizzle 스키마, 연결
        │   ├── config/       # 설정
        │   └── utils/        # 유틸리티 함수
        ├── drizzle.config.ts # Drizzle Kit 설정
        └── package.json
```
