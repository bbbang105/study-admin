# 랜딩 페이지 리디자인 + 로고/파비콘 디자인

## 결정 사항

| 항목 | 결정 |
|------|------|
| 톤/무드 | 다크 모드 기반 (Linear/Vercel 스타일) |
| 애니메이션 | 풀 애니메이션 (Framer Motion) |
| 카피 방향 | 성장 중심 ("함께 쓰고, 함께 성장하다") |
| 피처 범위 | 현재 동작하는 기능만 (Coming Soon 없음) |
| 디자인 접근 | Linear Clone 스타일 (다크 + 글로우 + 벤토 그리드) |
| 로고 | 픽토그램 SVG 창작 (큐시즘 블루 그라디언트) |

## 컬러 팔레트

- 큐시즘 블루 그라디언트: `#0091FF` → `#0055FF` → `#004DFF`
- 배경: `#000000` ~ `#0a0a0a`
- 텍스트: `#ffffff` (주), `#a1a1aa` (보조, zinc-400)
- 카드: `bg-zinc-900/50` + `border-zinc-800`
- 글로우: `#0055FF` 30-40% opacity radial gradient

## 섹션 구성

### 1. Navigation (스티키)
- 배경: `rgba(0,0,0,0.8)` + `backdrop-blur-xl`
- 스크롤 시 하단 보더 페이드인
- 좌: 로고 픽토그램 + "블로그 스터디"
- 우: Discord 로그인 버튼

### 2. Hero
- 배경: 블랙 + 블루 라디얼 글로우 (상단)
- 뱃지: "블로그 스터디 자동화 플랫폼"
- 헤드라인: "함께 쓰고, 함께 성장하다." (그라디언트 텍스트, text-6xl)
- 설명: 1-2줄 부가 설명 (zinc-400)
- CTA: "Discord로 시작하기" (그라디언트 배경 + 글로우)
- 서브텍스트: "무료 · 설정 5분 완료"
- 애니메이션: 배지 fade-down → 헤드라인 stagger fade-up → 설명 → CTA scale-in

### 3. Stats Bar
- 3개 스탯: 활동 멤버수, 총 포스트수, 현재 회차
- 서버 컴포넌트에서 실제 DB fetch
- countUp 애니메이션 (IntersectionObserver)
- 미세한 보더로 구분

### 4. Features Bento Grid
- 비대칭 2-column 벤토 (일부 카드 span-2)
- 6개 기능:
  1. RSS 자동 수집 (큰 카드)
  2. 랭킹 & 활동 점수
  3. 출석 자동화
  4. 커뮤니티 게시판
  5. 벌금 관리
  6. 큐레이션 (큰 카드)
- 카드: zinc-900/50 + zinc-800 보더 + 호버 글로우
- 스크롤 stagger fade-up

### 5. How It Works
- 3-step 가로 타임라인 (모바일: 세로)
  1. Discord 로그인 한 번
  2. 블로그 글을 쓰면 끝
  3. 대시보드에서 성장 확인
- 커넥팅 라인 draw 애니메이션
- 각 스텝 stagger 진입

### 6. Social Proof (아바타 마키)
- DiceBear fun-emoji 아바타 자동 스크롤 마키
- CSS @keyframes 무한 루프
- "함께하는 스터디원들과 성장 중" 문구

### 7. Final CTA + Footer
- 블루 라디얼 글로우 배경
- "지금 바로 시작하세요." + CTA 버튼 반복
- 푸터: © 2026 블로그 스터디 · Powered by KUSITMS

## 로고 & 파비콘

### 컨셉
- 픽토그램 SVG 창작
- 펜촉 + 우상향 화살표 (글쓰기 + 성장)
- 큐시즘 블루 그라디언트 적용 (`#0091FF → #004DFF`)
- 미니멀 지오메트릭 스타일

### 적용 범위
- `icon.svg` — 파비콘 (벡터)
- `icon-192.png` — PWA 아이콘 192x192
- `icon-512.png` — PWA 아이콘 512x512
- `manifest.json` — PWA manifest 업데이트
- 랜딩 헤더 로고
- 앱 사이드바 로고

## 기술 스택

| 항목 | 선택 |
|------|------|
| 애니메이션 | `framer-motion` (신규 설치) |
| 카운트업 | 커스텀 훅 + IntersectionObserver |
| 마키 | CSS @keyframes |
| 그리드 | Tailwind Grid + col-span/row-span |
| 글로우 | CSS radial-gradient + box-shadow |
| 그라디언트 텍스트 | bg-gradient-to-r + bg-clip-text |
| 반응형 | 모바일 single-column |
| 데이터 | 서버 컴포넌트에서 Stats fetch |
