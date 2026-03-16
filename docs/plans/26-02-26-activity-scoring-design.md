# 활동 점수 시스템 디자인

## 목표
스터디원 간 경쟁심리 자극 + 스터디 종료 시 Top 3 보상 기반. 블로그 포스팅이 핵심, 웹 활동이 보조.

## 점수 체계

| 카테고리 | 활동 | 점수 | 일일 상한 | 부여 위치 |
|---------|------|------|----------|----------|
| 블로그 | 포스트 발행 (RSS 수집) | +30점 | 60점 (2편) | 봇 |
| 웹 | 게시판 글 작성 | +10점 | 20점 (2편) | 웹 API |
| 웹 | 블로그 글 댓글 작성 | +5점 | 20점 (4개) | 웹 API |
| 웹 | 게시판 댓글 작성 | +2점 | 10점 (5개) | 웹 API |
| 웹 | 글 조회 (타인 글) | +3점 | 15점 (5개) | 웹 API |
| 관리자 | 수동 부여/차감 | 자유 | 없음 | 웹 API |

웹 일일 최대: 65점. 블로그 1편(30점)이 여전히 핵심.

## 변경 이력

### v2 (2026-03-16): 디스코드 → 웹 활동으로 전환
- **제거**: `discord_message` (+2), `discord_thread` (+3), `discord_reaction` (+1) — 봇 이벤트 핸들러 기반
- **추가**: `board_post` (+10), `post_comment` (+5), `board_comment` (+2) — 웹 API에서 직접 DB write
- **변경**: `post_view` 2→3점, 상한 10→15점
- **이유**: 디스코드 활동 추적은 MessageContent Intent 필요 + DB 반영 지연. 웹에서 직접 점수 부여하면 즉시 반영 + 구현 단순화

### v1 (2026-02-26): 최초 설계
- 디스코드 활동(메시지/스레드/리액션) 기반 점수 체계

## DB 스키마: activity_scores 테이블
- id, memberId, type (`blog_post`/`board_post`/`post_comment`/`board_comment`/`post_view`/`admin_manual`)
- points, description, date, createdAt
- memberId+type+date에 대한 일일 상한 체크용 인덱스

## 어뷰징 방지
- 본인 글 조회 점수 미부여
- 같은 글 중복 조회 불가 (post_views UNIQUE)
- 일일 상한으로 도배 방지

## 점수 부여 위치
1. **봇**: 블로그 포스트 RSS 수집 시 → `blog_post` 점수 자동 적립
2. **웹 API**: 게시판 글 작성 시 → `board_post` 점수 부여 (`/api/board` POST)
3. **웹 API**: 블로그 글 댓글 작성 시 → `post_comment` 점수 부여 (`/api/posts/[id]/comments` POST)
4. **웹 API**: 게시판 댓글 작성 시 → `board_comment` 점수 부여 (`/api/board/[id]/comments` POST)
5. **웹 API**: 글 조회 시 → `post_view` 점수 부여 (`/api/posts/[id]/view` POST)
6. **웹 관리자**: 수동 점수 부여/차감 + 사유 입력

## 구현 파일
- `packages/shared/src/db/schema.ts` — ActivityScoreType enum
- `packages/bot/src/services/score.service.ts` — SCORE_CONFIG (봇용)
- `packages/web/src/lib/score.ts` — grantWebScore (웹용)
- `packages/web/src/app/api/board/route.ts` — 게시판 글 점수
- `packages/web/src/app/api/posts/[id]/comments/route.ts` — 블로그 댓글 점수
- `packages/web/src/app/api/board/[id]/comments/route.ts` — 게시판 댓글 점수
- `packages/web/src/app/api/posts/[id]/view/route.ts` — 글 조회 점수
