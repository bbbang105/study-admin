# DB 스키마 요약

> 소스: `packages/shared/src/db/schema.ts`

## Enum 타입

| Enum | 값 | 용도 |
|------|-----|------|
| `MemberStatus` | `pending_approval`, `active`, `inactive`, `dormant`, `ob`, `withdrawn` | 멤버 상태 |
| `AttendanceStatus` | `pending`, `submitted`, `late`, `absent` | 출석 상태 |
| `FineType` | `late`, `absent` | 벌금 사유 |
| `FineStatus` | `unpaid`, `paid`, `waived` | 벌금 납부 |
| `CurationCategory` | `conference`, `article` | 큐레이션 분류 |
| `ActivityScoreType` | `blog_post`, `board_post`, `post_comment`, `board_comment`, `admin_manual`, `post_view` | 활동 점수 |
| `BoardCategory` | `notice`, `suggestion`, `review`, `knowledge`, `daily`, `etc` | 게시판 카테고리 (const object) |
| `NotificationType` | `board_comment`, `board_reply`, `post_comment`, `post_reply`, `board_notice` | 알림 유형 (const object) |

## 테이블

### members
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | defaultRandom |
| `discord_id` | varchar(20) | unique, not null |
| `discord_username` | varchar(100) | not null |
| `name` | varchar(50) | not null |
| `nickname` | varchar(100) | not null |
| `part` | varchar(50) | not null |
| `blog_url` | varchar(500) | not null |
| `rss_url` | varchar(500) | nullable |
| `profile_image_url` | varchar(500) | nullable |
| `bio` | varchar(200) | nullable |
| `interests` | text[] | nullable |
| `resolution` | varchar(300) | nullable |
| `onboarding_completed` | boolean | default false |
| `rss_consent` | boolean | default true |
| `github_url`, `linkedin_url`, `instagram_url` | varchar(500) | 소셜 링크 |
| `status` | varchar(20) | default 'active' |
| `dormant_start_round` | integer | nullable |
| `dormant_used` | boolean | default false |
| `joined_at`, `updated_at` | timestamptz | defaultNow |

### rounds
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | serial PK | |
| `round_number` | integer | unique, not null |
| `start_date`, `end_date`, `grace_end_date` | date | not null |
| `is_current` | boolean | default false |

### posts
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | |
| `member_id` | uuid FK → members | not null |
| `round_id` | integer FK → rounds | nullable |
| `title` | varchar(500) | not null |
| `url` | varchar(1000) | unique, not null |
| `published_at` | timestamptz | not null |
| `description` | text | nullable |
| `thumbnail_url` | varchar(1000) | nullable, OG 이미지 |
| `comment_count` | integer | default 0 |
| `collected_at` | timestamptz | defaultNow |

### attendance
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | |
| `member_id` | uuid FK → members | not null |
| `round_id` | integer FK → rounds | not null |
| `status` | varchar(20) | default 'pending' |
| `submitted_at` | timestamptz | nullable |
| unique constraint: `(member_id, round_id)` |

### fines
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | |
| `member_id` | uuid FK → members | not null |
| `round_id` | integer FK → rounds | not null |
| `type` | varchar(20) | late/absent |
| `amount` | integer | not null |
| `status` | varchar(20) | default 'unpaid' |
| unique constraint: `(member_id, round_id)` |

### activity_scores
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | |
| `member_id` | uuid FK → members | not null |
| `type` | varchar(30) | ActivityScoreType |
| `points` | integer | not null |
| `description` | varchar(300) | nullable |
| `date` | date | 일일 상한 체크용 |

### post_views
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | |
| `member_id` | uuid FK → members | not null |
| `post_id` | uuid FK → posts | not null |
| unique constraint: `(member_id, post_id)` |

### config
`key` (varchar PK) / `value` (text) / `updated_at` — 설정 키-값 저장소

### board_posts
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | defaultRandom |
| `member_id` | uuid FK → members | not null |
| `category` | varchar(20) | BoardCategory, not null |
| `title` | varchar(200) | not null |
| `content` | jsonb | Tiptap JSON, not null |
| `content_text` | text | 검색용 평문, not null |
| `is_secret` | boolean | default false |
| `is_pinned` | boolean | default false |
| `is_notice_banner` | boolean | default false, 글로벌 배너 활성화 (1개만) |
| `comment_count` | integer | default 0 |
| `created_at`, `updated_at` | timestamptz | defaultNow |
| `deleted_at` | timestamptz | nullable (soft delete) |
| 인덱스: `member_id`, `category`, `is_pinned`, `created_at` |

### board_comments
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | defaultRandom |
| `post_id` | uuid FK → board_posts | not null |
| `member_id` | uuid FK → members | not null |
| `parent_id` | uuid FK → board_comments | nullable (대댓글) |
| `content` | text | not null |
| `is_secret` | boolean | default false |
| `created_at`, `updated_at` | timestamptz | defaultNow |
| `deleted_at` | timestamptz | nullable (soft delete) |
| 인덱스: `post_id`, `member_id`, `parent_id` |

### fcm_tokens
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | defaultRandom |
| `member_id` | uuid FK → members | not null |
| `token` | text | not null |
| `device_info` | text | nullable |
| `last_used_at` | timestamptz | defaultNow |
| unique constraint: `(member_id, token)` |
| 인덱스: `member_id` |

### notification_preferences
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | uuid PK | defaultRandom |
| `member_id` | uuid FK → members | not null |
| `type` | varchar(30) | NotificationType, not null |
| `enabled` | boolean | default true |
| `updated_at` | timestamptz | defaultNow |
| unique constraint: `(member_id, type)` |
| 인덱스: `member_id` |

### keywords, curation_sources, curation_items
- `keywords`: keyword(unique) + frequency + last_updated
- `curation_sources`: url(unique) + name + category + rss_url + tags[] + is_active
- `curation_items`: source_id FK → curation_sources, url(unique) + title + description + thumbnail_url + category + tags[] + relevance_score + is_shared

## FK 관계 요약

```
members ──< posts (member_id)
members ──< attendance (member_id)
members ──< fines (member_id)
members ──< activity_scores (member_id)
members ──< post_views (member_id)
rounds  ──< posts (round_id)
rounds  ──< attendance (round_id)
rounds  ──< fines (round_id)
posts   ──< post_views (post_id)
curation_sources ──< curation_items (source_id)
members ──< board_posts (member_id)
members ──< board_comments (member_id)
board_posts ──< board_comments (post_id)
board_comments ──< board_comments (parent_id, self-ref)
members ──< fcm_tokens (member_id)
members ──< notification_preferences (member_id)
```

## 타입 Export

모든 테이블에 `Type`/`NewType` export 있음 (예: `Member`/`NewMember`, `Post`/`NewPost`, `BoardPost`/`NewBoardPost`, `BoardComment`/`NewBoardComment`, `FcmToken`/`NewFcmToken`, `NotificationPreference`/`NewNotificationPreference`)
