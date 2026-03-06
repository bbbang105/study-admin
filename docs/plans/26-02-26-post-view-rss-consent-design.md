# Post View Scoring + RSS Consent + Manual Post Upload

## Overview

세 가지 기능을 추가한다:
1. **글 조회 점수**: 다른 멤버의 글을 클릭하면 활동 점수 부여
2. **RSS 수집 동의**: 온보딩/프로필에서 RSS 자동 수집 여부 설정
3. **수동 글 등록**: RSS 비동의 시 직접 글 URL을 등록

## 1. 글 조회 점수 (POST_VIEW)

### 점수 정책
- **점수**: 2점/회
- **일일 최대**: 5회 (일일 상한 10점)
- **중복 제한**: 같은 글 중복 조회 불가
- **본인 글**: 점수 부여 안 함

### DB 변경
- `ActivityScoreType`에 `POST_VIEW = 'post_view'` 추가
- `post_views` 테이블 신규:
  - `id` UUID PK
  - `member_id` UUID FK → members.id
  - `post_id` UUID FK → posts.id
  - `viewed_at` TIMESTAMP
  - UNIQUE(member_id, post_id)

### 트래킹 방식
- 글 목록에서 클릭 시 `POST /api/posts/[id]/view` fire-and-forget 호출
- API에서 중복 + 일일 한도 + 본인 글 체크
- 외부 링크는 즉시 오픈 (UX 변화 없음)

### ScoreService 변경
- `SCORE_CONFIG`에 `POST_VIEW: { points: 2, dailyCap: 10 }` 추가

## 2. RSS 수집 동의 설정

### DB 변경
- `members` 테이블에 `rss_consent` BOOLEAN DEFAULT true 추가

### 온보딩 (Step 1)
- Blog URL 아래에 토글: "RSS 자동 수집 동의" (디폴트 ON)
- OFF 시 안내: "RSS 수집을 비활성화하면 글을 직접 등록해야 합니다."

### 프로필 편집 (/profile/edit)
- Blog URL 카드에 동일한 토글 + 안내 문구

### 봇 RSS 수집
- `rss_consent = false`인 멤버는 RSS 폴링 스킵

## 3. 수동 글 등록

### UI
- 글 목록 페이지 우측 상단 "글 등록" 버튼
- 모달: URL 입력 → OG 크롤링 → 제목/발행일 자동 추출
- 크롤링 실패 시: 제목 입력 필드 노출 + 안내 문구

### API: POST /api/posts/manual
- URL → OG 크롤링 (title, published_time)
- 실패 시 클라이언트에서 title 입력받아 재요청
- 중복 URL 체크 (posts.url UNIQUE)
- 현재 진행 회차 자동 매칭
- BLOG_POST 점수(30점) 부여
