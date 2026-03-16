# 게시판 투표 기능

## 개요

카카오톡 스타일의 투표 기능으로 게시판 참여도를 높이고 멤버들의 의견을 쉽게 수렴할 수 있습니다.

## 기능

### 투표 유형

| 유형 | 설명 | 투표자 공개 |
|------|------|-----------|
| **단일 선택** | 하나의 선택지만 선택 가능 | ✅ 공개 |
| **복수 선택** | 여러 선택지 선택 가능 | ✅ 공개 |
| **날짜 투표** | 일정 조율용 날짜 선택 | ✅ 공개 |
| **익명 투표** | 누가 투표했는지 비공개 | ❌ 비공개 |

### 투표 생성

- **위치**: 게시글 작성 페이지
- **버튼**: "투표 추가" 클릭
- **필수 항목**:
  - 질문 (투표 제목)
  - 투표 유형
  - 선택지 (최소 2개)
  - 마감시간 (1시간/6시간/1일/3일/1주)

### 투표 참여

- **조건**: 로그인 필요
- **제한**: 마감시간 경과 시 참여 불가
- **변경**: 단일/복수 투표는 재투표 가능 (기존 투표 대체)
- **익명**: 익명 투표는 투표자 정보 비공개

### 투표 관리

- **위치**: 게시글 수정 페이지 > "투표 관리" 버튼
- **권한**: 게시글 작성자 또는 관리자
- **제한**: 투표 참여자가 0명일 때만 수정/삭제 가능
- **수정 가능 항목**:
  - 질문
  - 투표 유형
  - 선택지 (추가/삭제/편집, 최소 2개 유지)
  - 마감시간 연장

### 투표 현황

- **표시 항목**:
  - 질문과 투표 유형 뱃지
  - 마감시간 (남은 시간 또는 "마감됨")
  - 총 참여자 수
  - 선택지별 투표 현황 (표수, 백분율, 진행바)
  - 투표자 목록 (익명 투표 제외)

- **게시판 목록**:
  - 투표가 있는 게시글에 📊 아이콘 표시
  - 투표 개수 표시 (인디고색)

## 화면

### 투표 생성 화면

```
┌─────────────────────────────────────┐
│ 📊 투표 추가                         │
├─────────────────────────────────────┤
│ 질문:                             │
│ ┌───────────────────────────────┐ │
│ │ 이번 주말에 맛집할까요?      │ │
│ └───────────────────────────────┘ │
│                                     │
│ 투표 유형: ○ 단일 선택  ● 복수 선택 │
│                                     │
│ 마감시간: [1일 ▼]                  │
│                                     │
│ 선택지 (최소 2개):                │
│ ┌───────────────────────────────┐ │
│ │ 1. 토요일 (오후)        [x]  │ │
│ │ 2. 토요일 (저녁)        [x]  │ │
│ │ 3. 일요일               [x]  │ │
│ │ [+ 선택지 추가]               │ │
│ └───────────────────────────────┘ │
│                                     │
│ [삭제]                               │
└─────────────────────────────────────┘
```

### 투표 현황 화면

```
📊 이번 주말에 맛집할까요?
⏰ 3일 후 마감 • 12명 참여
[단일 선택]

┌──────────────────────────────────┐
│ ✅ 토요일 (오후)               │ 45%  │
│ [홍길동] [철수] [영희] [민수]     │ ████ │
│ [상세보기 5명]                   │      │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ ⭕ 토요일 (저녁)                │ 30%  │
│ [철수] [영희]                    │ ███   │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ ⭕ 일요일                       │ 25%  │
│ [민수]                           │ ██   │
└──────────────────────────────────┘

[투표하기]
```

### 투표 관리 화면

```
┌─────────────────────────────────────┐
│ 투표 관리                            │
├─────────────────────────────────────┤
│                                     │
│ 📊 이번 주말에 맛집할까요?          │
│ [단일 선택] • 0명 참여              │
│                                     │
│ [연필] [휴지통]                     │
│                                     │
│ ──────────────────────────────     │
│                                     │
│ 질문:                             │
│ ┌───────────────────────────────┐ │
│ │ 이번 주말에 맛집할까요?      │ │
│ └───────────────────────────────┘ │
│                                     │
│ 투표 유형: [단일 선택 ▼]           │
│                                     │
│ 선택지 (최소 2개):                │
│ ┌───────────────────────────────┐ │
│ │ 토요일 (오후)           [🗑️] │ │
│ │ 토요일 (저녁)           [🗑️] │ │
│ │ 일요일                  [🗑️] │ │
│ │ [+ 선택지 추가]               │ │
│ └───────────────────────────────┘ │
│                                     │
│ 마감시간 연장:                      │
│ [+1시간] [+6시간] [+1일] [+3일] [+1주]│
│                                     │
│ [취소] [저장]                       │
└─────────────────────────────────────┘
```

## 데이터베이스

### 테이블 구조

#### board_polls

```sql
CREATE TABLE board_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  poll_type TEXT NOT NULL CHECK (poll_type IN ('single', 'multiple', 'date', 'anonymous')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  allow_add_option BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_board_polls_post_id ON board_polls(post_id);
```

#### board_poll_options

```sql
CREATE TABLE board_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES board_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_board_poll_options_poll_id ON board_poll_options(poll_id);
```

#### board_poll_votes

```sql
CREATE TABLE board_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES board_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES board_poll_options(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  anonymous_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_board_poll_votes_poll_id ON board_poll_votes(poll_id);
```

### 제약 조건

- **단일 투표**: `member_id`당 1개의 선택지만 가능
- **복수 투표**: 여러 선택지 선택 가능, 중복 방지
- **익명 투표**: `member_id` NULL, `anonymous_id` 사용
- **소프트 삭제**: `deleted_at`으로 삭제 처리

## API

### GET /api/board/[id]/polls

투표 현황 조회

**Response:**
```json
{
  "success": true,
  "data": {
    "polls": [
      {
        "id": "uuid",
        "question": "이번 주말에 맛집할까요?",
        "pollType": "single",
        "expiresAt": "2026-03-16T18:00:00Z",
        "allowAddOption": true,
        "isExpired": false,
        "hasVoted": false,
        "totalVotes": 12,
        "options": [
          {
            "id": "uuid",
            "optionText": "토요일 (오후)",
            "voteCount": 5,
            "percentage": 45,
            "voted": false,
            "voters": [
              {
                "memberId": "uuid",
                "name": "홍길동",
                "profileImage": null,
                "discordId": "123456789",
                "votedAt": "2026-03-13T10:00:00Z"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### POST /api/board/[id]/polls/[pollId]/vote

투표 참여

**Request:**
```json
{
  "optionIds": ["uuid"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "투표가 완료되었습니다."
}
```

### DELETE /api/board/[id]/polls/[pollId]

투표 삭제 (참여자 0명일 때만 가능)

**Response:**
```json
{
  "success": true,
  "message": "투표가 삭제되었습니다."
}
```

### PATCH /api/board/[id]/polls/[pollId]

투표 수정 (참여자 0명일 때만 가능)

**Request:**
```json
{
  "question": "수정된 질문",
  "pollType": "multiple",
  "expiresAt": "2026-03-20T18:00:00Z",
  "options": [
    {
      "id": "uuid",
      "optionText": "수정된 선택지"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "투표가 수정되었습니다."
}
```

## 사용자 흐름

### 투표 생성

1. 게시글 작성 페이지 접속
2. "투표 추가" 버튼 클릭
3. 질문, 유형, 선택지, 마감시간 입력
4. 게시글 작성 완료
5. 게시글과 함께 투표 자동 생성

### 투표 참여

1. 게시글 상세 페이지 접속
2. 투표 현황 확인
3. "투표하기" 버튼 클릭
4. 선택지 선택 모달 표시
5. 선택지 선택 후 "투표하기" 클릭
6. 투표 완료 메시지 및 현황 갱신

### 투표 수정/삭제

1. 내 게시글 수정 페이지 접속
2. "투표 관리" 버튼 클릭
3. 수정할 투표의 연필 아이콘 클릭
4. 질문, 유형, 선택지, 마감시간 수정
5. "저장" 버튼 클릭
6. 투표 수정 완료

## 제한 사항

- **투표 수정**: 참여자가 1명 이상이면 수정/삭제 불가
- **마감시간**: 마감된 투표는 참여 불가
- **중복 참여**: 단일 투표는 재투표 시 기존 투표 대체
- **익명 투표**: 투표자 정보 완전히 비공개
- **선택지**: 최소 2개 이상 필수

## 변경 사항

### v1.0.0 (2026-03-13)

**추가 기능:**
- 게시판 투표 기능 구현
- 4가지 투표 유형 지원 (단일/복수/날짜/익명)
- 투표 생성, 참여, 수정, 삭제 기능
- 투표 현황 실시간 표시
- 투표자 목록 상세보기 모달
- 게시판 목록에 투표 아이콘 표시

**API 변경:**
- `GET /api/board` - `pollCount` 필드 추가
- `POST /api/board` - `polls` 배열 지원
- `GET /api/board/[id]/polls` - 투표 현황 조회
- `POST /api/board/[id]/polls/[pollId]/vote` - 투표 참여
- `DELETE /api/board/[id]/polls/[pollId]` - 투표 삭제
- `PATCH /api/board/[id]/polls/[pollId]` - 투표 수정

**UI 변경:**
- `PollEditor` - 투표 생성 폼
- `PollDisplay` - 투표 현황 표시
- `PollVoteModal` - 투표 참여 모달
- `PollManagerModal` - 투표 관리 모달
- 게시판 목록에 투표 아이콘 (BarChart3) 표시

**DB 스키마:**
- `board_polls` 테이블 추가
- `board_poll_options` 테이블 추가
- `board_poll_votes` 테이블 추가
- `poll_type` enum 추가

## 참고

- [기존 게시판 시스템](./26-03-06-ui-design-system.md)
- [DB 스키마](./26-03-06-schema-summary.md)
- [API 패턴](./26-03-06-patterns.md)
