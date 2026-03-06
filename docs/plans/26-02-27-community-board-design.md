# 커뮤니티 게시판 설계

## 개요

블로그 스터디 커뮤니티 게시판. 관리자/일반 유저 모두 글 작성 가능. Tiptap 리치 에디터, 비밀글/비밀댓글, 무한 대댓글 지원.

## 카테고리

| 카테고리 | 값 | 작성 권한 | 설명 |
|---------|-----|----------|------|
| 공지 | `notice` | 관리자만 | 항상 최상단 고정 |
| 건의 | `suggestion` | 전체 | 비밀글 가능 |
| 후기 | `review` | 전체 | 온/오프라인 모임 후기 |
| 지식공유 | `knowledge` | 전체 | 기술/학습 자료 공유 |
| 일상 | `daily` | 전체 | 자유 주제 |
| 기타 | `etc` | 전체 | 분류 외 |

## DB 스키마

### board_posts

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | gen_random_uuid() |
| member_id | uuid FK → members.id | 작성자 |
| category | varchar NOT NULL | BoardCategory enum |
| title | varchar(200) NOT NULL | 제목 |
| content | jsonb NOT NULL | Tiptap JSON |
| content_text | text NOT NULL | 검색/미리보기용 plain text |
| is_secret | boolean default false | 비밀글 (건의 카테고리) |
| is_pinned | boolean default false | 고정 (공지 자동 고정) |
| comment_count | integer default 0 | 비정규화 댓글 수 |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |
| deleted_at | timestamptz | soft delete |

### board_comments

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | gen_random_uuid() |
| post_id | uuid FK → board_posts.id | 소속 게시글 |
| member_id | uuid FK → members.id | 작성자 |
| parent_id | uuid FK → board_comments.id NULL | 대댓글 셀프참조 |
| content | text NOT NULL | 댓글 내용 |
| is_secret | boolean default false | 비밀 댓글 |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |
| deleted_at | timestamptz | soft delete |

## API 라우트

```
GET    /api/board                       목록 (카테고리 필터, 페이지네이션, 공지 고정)
GET    /api/board/[id]                  상세 (댓글 트리 포함)
POST   /api/board                       작성 (공지는 관리자만)
PATCH  /api/board/[id]                  수정 (본인만)
DELETE /api/board/[id]                  삭제 (본인 + 관리자)

POST   /api/board/[id]/comments         댓글 작성
PATCH  /api/board/[id]/comments/[cid]   댓글 수정 (본인만)
DELETE /api/board/[id]/comments/[cid]   댓글 삭제 (본인 + 관리자)
```

## 페이지 구조

```
/board              게시판 목록 (카테고리 탭 + 테이블)
/board/write        글 작성 (Tiptap 에디터)
/board/[id]         글 상세 + 댓글
/board/[id]/edit    글 수정
```

## 권한 매트릭스

| 액션 | 일반 유저 | 관리자 |
|------|----------|--------|
| 글 작성 (공지 외) | O | O |
| 공지 작성 | X | O |
| 글 수정 | 본인만 | 삭제만 가능 |
| 글 삭제 | 본인만 | 모든 글 |
| 댓글 작성 | O | O |
| 댓글 수정 | 본인만 | 삭제만 가능 |
| 댓글 삭제 | 본인만 | 모든 댓글 |
| 비밀글 열람 | 작성자만 | O |
| 비밀댓글 열람 | 작성자+글작성자 | O |

## 비밀글/비밀댓글 규칙

- **비밀글**: 목록에서 제목 "비밀글입니다" 마스킹, 작성자도 마스킹. 작성자+관리자만 열람
- **비밀댓글**: "비밀 댓글입니다" 마스킹. 댓글 작성자+글 작성자+관리자만 열람
- 건의 카테고리에서 주로 사용되지만 다른 카테고리에서도 사용 가능

## 공지 고정 규칙

- 카테고리 `notice`이면 자동으로 `is_pinned=true`
- 목록에서 항상 최상단 고정 (최신 공지순)
- 공지 영역과 일반 글 영역 시각적 구분 (배경색 또는 구분선)

## UI 설계

### 목록 페이지 (/board)
- 카테고리 탭 필터: 전체 / 공지 / 건의 / 후기 / 지식공유 / 일상 / 기타
- 테이블/리스트 형태
- 공지 고정 영역 + 일반 글 영역
- 페이지네이션
- 글쓰기 버튼

### 상세 페이지 (/board/[id])
- 제목, 카테고리 뱃지, 작성자 프로필(아바타+닉네임), 날짜
- Tiptap 렌더링된 본문
- 댓글 트리 (대댓글 UI에서 2~3단계까지 들여쓰기, 이후 flat)
- 댓글 작성 폼 (비밀 댓글 체크박스)

### 글 작성 (/board/write)
- 카테고리 선택 (관리자만 공지 선택 가능)
- 제목 입력
- Tiptap 리치 에디터 (굵은글씨, 이탤릭, 리스트, 코드블록, 링크)
- 비밀글 체크박스
- 등록 버튼

## 기술 선택

- **에디터**: Tiptap (headless, React 통합 우수, JSON 출력)
- **댓글 트리**: 서버에서 flat 반환 → 클라이언트에서 트리 구조로 변환
- **페이지네이션**: offset 기반 (기존 패턴과 동일)
- **soft delete**: `deleted_at` 컬럼, "삭제된 글/댓글입니다" 표시
