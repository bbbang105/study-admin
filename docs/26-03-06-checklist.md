# 구현 체크리스트

전면 개편 작업 순서. 의존성 순서대로 정렬.

---

## Phase 0: 기반 정리 ✅

- [x] 기존 `.kiro/`, `.vscode/`, 구 `docs/` 파일 제거
- [x] 새 `CLAUDE.md` 및 `docs/` 문서 체계 확립
- [x] Git 초기 커밋 (새 출발점)

## Phase 3: 인증 전환 (Supabase Auth) ✅

> Phase 1보다 먼저 진행됨 (인증이 모든 기능의 기반)

- [x] Supabase 프로젝트에 Discord OAuth 프로바이더 설정
- [x] `@supabase/ssr` 기반 클라이언트 설정 (`packages/web/src/lib/supabase/`)
- [x] 로그인 페이지: "Discord로 로그인" 버튼으로 교체
- [x] 회원가입 페이지 제거 (Discord OAuth로 통합)
- [x] `middleware.ts` → Supabase Auth 세션 체크로 교체
- [x] 관리자 권한: Discord ID + `ADMIN_DISCORD_IDS` 매칭
- [x] 기존 auth 관련 파일/라우트 제거
- [x] `api/auth/callback` 라우트 추가 (Supabase OAuth 콜백)
- [x] 모든 API 라우트 Supabase Auth 기반으로 리팩토링
- [x] DB 스키마에서 `users`, `sessions` 테이블 제거
- [x] 보안 강화 (오픈 리다이렉트 방지, 입력 검증)
- [x] 불필요한 의존성 제거: `bcryptjs`, `jsonwebtoken`, `jose`, `resend`
- [x] DB 연결: Transaction Pooler 지원 (`prepare: false`)
- [x] 빌드 검증 통과
- [ ] RLS 정책 설정 (배포 시)

## Phase 1: 의존성 업그레이드 ✅

- [x] Next.js 14 → 16 업그레이드 (PR #5)
- [x] Tailwind CSS v3 → v4 업그레이드 (PR #5)
- [x] React 18 → 19 업그레이드 (PR #5)
- [x] `rss-parser` → `feedsmith` 교체
- [x] `node-cron` → `pg-boss` 교체
- [x] 전체 빌드 확인 (`pnpm build`)

## Phase 4: Bot 개편 (pg-boss + feedsmith) ✅

- [x] `feedsmith` 기반 RSS 서비스 재구현
- [x] `pg-boss` 기반 스케줄러 전환 (6개 잡)
- [x] RSS→PostService.create→NotificationService 파이프라인 연결
- [x] graceful shutdown에 pg-boss 정리 추가

## Phase 6: 웹 UI 전면 리디자인

### 6-1: 디자인 시스템 기반
- [ ] globals.css 컬러 토큰 재정의 (스카이블루 포인트)
- [x] Pretendard 폰트 설정
- [x] Tailwind CSS v4 + 디자인 토큰 설정
- [x] next-themes 다크모드 설정
- [x] shadcn/ui 컴포넌트 테마 커스터마이징

### 6-2: 레이아웃 ✅
- [x] AppLayout (사이드바 + 헤더 + 메인)
- [x] Sidebar (접기/펼치기, 활성 인디케이터, 아이콘 모드)
- [x] 반응형: 모바일 드로어, 태블릿/데스크톱 사이드바

### 6-3: Public 페이지
- [ ] 랜딩 페이지 (/) - 스터디 소개, 로그인 유도
- [x] 로그인 페이지 (/login) - Discord OAuth 버튼

### 6-4: 사용자 페이지 ✅
- [x] 대시보드 (/dashboard) - 현재 회차, 내 출석, 최근 글
- [x] 글 목록 (/posts) - 스터디원 글 + 수동 등록 + 페이지네이션
- [x] 랭킹 (/ranking) - 포디움, 정렬 (총점/포스트/활동), 출석 히트맵
- [x] 큐레이션 (/curation) - 추천/최신 정렬, 카테고리/태그 필터, 무한 스크롤
- [x] 게시판 (/board) - 카테고리별 게시글 + 댓글 + 비밀글 + Tiptap 에디터
- [x] 멤버 목록 (/members) - 활동 멤버 그리드
- [x] 멤버 프로필 (/members/[id]) - 상세 프로필 + 활동 통계
- [x] 프로필 (/profile) - 내 정보 조회/수정
- [x] 온보딩 (/profile/onboarding) - 최초 가입 설정

### 6-5: 관리자 페이지
- [x] 관리자 대시보드 (/admin) - 요약 통계, 활동 피드
- [x] 멤버 관리 (/admin/members) - CRUD + 승인 + 상태 관리
- [ ] 출석 관리 (/admin/attendance) - 멤버 × 회차 그리드 (검증 필요)
- [ ] 벌금 관리 (/admin/fines) - 납부/면제 처리 (검증 필요)
- [ ] 점수 관리 (/admin/scores) - 수동 부여/삭제 (검증 필요)
- [x] 큐레이션 소스 (/admin/curation) - 소스 관리 + 크롤링
- [ ] 설정 (/admin/settings) - 스터디 설정 (검증 필요)

### 6-6: Supabase Realtime 통합 (선택적)
- [ ] 활동 피드 컴포넌트 (실시간 업데이트)
- [ ] 대시보드 통계 실시간 반영

## Phase 7: 통합 테스트 및 배포

- [ ] 전체 빌드 성공 확인
- [ ] 타입 체크 통과
- [ ] 린트 통과
- [ ] Supabase 프로덕션 설정
  - RLS 정책
  - Discord OAuth 프로바이더
- [ ] AWS EC2 배포 (Bot)
  - 환경 변수 설정
  - 빌드 확인
- [ ] Vercel 배포 (Web)
  - 환경 변수 설정
  - Supabase URL/키 설정
  - 빌드 확인
- [ ] E2E 수동 테스트
  - Discord 봇 커맨드 전체 동작
  - 웹 로그인 플로우
  - RSS 수집 → 알림 파이프라인
  - 관리자 페이지 전체 기능

---

## 우선순위 요약

```
Phase 0 (정리) ✅
    ↓
Phase 3 (인증) ✅
    ↓
Phase 1 (의존성) ✅
    ↓
Phase 4 (봇) ✅
    ↓
Phase 6 (UI) ←── 관리자 페이지 검증 + 랜딩 + 디자인 정비 남음
    ↓
Phase 7 (배포)
```
