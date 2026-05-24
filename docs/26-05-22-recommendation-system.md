# 큐레이션/스터디 글 맞춤 추천 로직

이 문서는 `feat/curation-vector-recommendations` 브랜치에서 추가된 맞춤 추천 기능의 전체 동작을 설명한다.

대상 기능은 두 가지다.

- `/curation` 추천 탭: 외부 아티클/컨퍼런스 큐레이션을 사용자 프로필에 맞게 정렬한다.
- `/posts` 추천 탭: 스터디원이 올린 글을 로그인 사용자에게 맞게 정렬하고 추천 이유 배지를 보여준다.

핵심 아이디어는 간단하다. 글과 사용자의 관심 프로필을 각각 임베딩 벡터로 만들고, 두 벡터의 코사인 유사도를 추천 점수의 중심으로 사용한다. 여기에 최신성, 기존 관련도, 인기, 작성자와의 파트/관심사 유사도를 보정 점수로 섞는다.

---

## 전체 흐름

```text
사용자 온보딩/프로필 수정
  -> part + interests + bio로 preference_text 생성
  -> 임베딩 서버 호출
  -> member_preference_embeddings에 upsert

큐레이션 수집/관리자 크롤링
  -> title + description + tags + sourceName으로 embedding_text 생성
  -> 임베딩 서버 호출
  -> curation_items.embedding 컬럼 갱신

스터디 글 RSS 수집/수동 등록/수정
  -> title + description + author part/interests/bio + round로 embedding_text 생성
  -> 임베딩 서버 호출
  -> post_embeddings에 upsert

사용자가 추천 탭 진입
  -> 로그인 Discord ID로 members.id 조회
  -> member_preference_embeddings 조회
  -> 있으면 벡터 추천 정렬
  -> 없으면 큐레이션은 태그 overlap fallback, 포스트는 최신순 fallback
  -> recommendationReason 생성
  -> 프론트에서 추천 이유/점수 배지 표시
```

---

## 데이터 모델

### `member_preference_embeddings`

사용자 취향 벡터를 저장한다.

| 컬럼                   | 의미                                     |
| ---------------------- | ---------------------------------------- |
| `member_id`            | `members.id` PK/FK                       |
| `preference_text`      | 임베딩에 사용한 사용자 취향 문장         |
| `preference_text_hash` | 같은 문장인지 비교하기 위한 SHA-256 해시 |
| `embedding`            | `extensions.vector(768)`                 |
| `embedding_model`      | 사용한 임베딩 모델명                     |
| `refreshed_at`         | 마지막 갱신 시각                         |

취향 문장은 `packages/shared/src/ai/embedding-text.ts`의 `buildMemberPreferenceText`에서 만든다.

```text
{part} 개발자. 관심사: {interests}. 소개: {bio}
```

예시:

```text
Backend 개발자. 관심사: AI, LLM, 데이터베이스. 소개: 검색과 추천 시스템에 관심이 있습니다.
```

현재 백필 대상은 추천 화면에서 의미가 있는 멤버 상태인 `active`, `ob`, `dormant`다.

### `curation_items` 임베딩 컬럼

큐레이션 아이템은 본 테이블에 임베딩 컬럼을 둔다.

| 컬럼                  | 의미                       |
| --------------------- | -------------------------- |
| `embedding`           | `extensions.vector(768)`   |
| `embedding_text_hash` | 임베딩 텍스트 SHA-256 해시 |
| `embedding_model`     | 사용한 임베딩 모델명       |
| `embedded_at`         | 마지막 임베딩 시각         |

큐레이션 임베딩 텍스트는 `buildCurationItemEmbeddingText`가 만든다.

```text
Title: {title}
Description: {description}
Tags: {tags}
Source: {sourceName}
```

### `post_embeddings`

스터디 글은 `posts` 테이블을 추천 메타데이터로 오염시키지 않기 위해 별도 테이블에 저장한다.

| 컬럼                  | 의미                       |
| --------------------- | -------------------------- |
| `post_id`             | `posts.id` PK/FK           |
| `embedding`           | `extensions.vector(768)`   |
| `embedding_text`      | 임베딩에 사용한 원문       |
| `embedding_text_hash` | 임베딩 텍스트 SHA-256 해시 |
| `embedding_model`     | 사용한 임베딩 모델명       |
| `embedded_at`         | 마지막 임베딩 시각         |

포스트 임베딩 텍스트는 `buildPostEmbeddingText`가 만든다.

```text
Title: {title}
Description: {description}
Author part: {authorPart}
Author: {authorNickname}
Author interests: {authorInterests}
Author bio: {authorBio}
Round: {roundNumber}
```

작성자 정보까지 넣는 이유는 글 본문/설명이 빈약한 경우에도 작성자의 파트와 관심사로 글의 대략적인 맥락을 보강하기 위해서다.

---

## 임베딩 생성

임베딩 생성은 봇 서버의 `EmbeddingService`가 담당한다.

파일:

- `packages/bot/src/services/embedding.service.ts`
- `packages/bot/src/api-server.ts`
- `packages/web/src/lib/embedding-refresh.ts`

지원 provider:

- `ollama`
- `openai-compatible`

필요 환경변수:

```bash
EMBEDDING_PROVIDER=openai-compatible 또는 ollama
EMBEDDING_BASE_URL=...
EMBEDDING_MODEL=...
EMBEDDING_DIMENSIONS=768
EMBEDDING_ACCESS_CLIENT_ID=...
EMBEDDING_ACCESS_CLIENT_SECRET=...
EMBEDDING_API_KEY=...
```

`EMBEDDING_ACCESS_CLIENT_ID`와 `EMBEDDING_ACCESS_CLIENT_SECRET`은 Cloudflare Access 같은 보호막 뒤에 임베딩 서버가 있을 때 사용한다. `EMBEDDING_API_KEY`는 OpenAI-compatible 서버의 Bearer 인증이 필요할 때 사용한다.

웹 서버는 직접 임베딩을 만들지 않는다. 대신 Next.js `after()`로 봇 내부 API를 fire-and-forget 호출한다.

```text
웹 API 요청 성공
  -> 응답은 먼저 반환
  -> after()에서 봇 /api/internal/embedding/... 호출
  -> 봇이 DB 조회 후 임베딩 생성/저장
```

이 구조의 의도:

- 사용자 요청을 임베딩 서버 지연에 묶지 않는다.
- 임베딩 서버 장애가 있어도 글 등록/프로필 저장 자체는 성공한다.
- 실패분은 백필 스크립트로 복구할 수 있다.

봇 내부 API:

| API                                              | 용도                                   |
| ------------------------------------------------ | -------------------------------------- |
| `POST /api/internal/embedding/member-preference` | 멤버 1명의 취향 임베딩 갱신            |
| `POST /api/internal/embedding/curation-item`     | 큐레이션 아이템 1개의 임베딩 갱신      |
| `POST /api/internal/embedding/post`              | 포스트 1개의 임베딩 갱신               |
| `POST /api/internal/embedding/batch`             | 멤버/큐레이션/포스트 ID 배열 일괄 갱신 |

일괄 API는 요청당 ID 개수를 제한하고 UUID 형식을 검증한다. 웹 쪽 `scheduleCurationItemEmbeddingRefresh`, `schedulePostEmbeddingRefresh`도 중복 제거 후 최대 100개까지만 넘긴다.

---

## 큐레이션 태그 추론

큐레이션 추천에는 벡터 점수가 중심이지만, 태그는 필터와 fallback 추천 이유에 계속 중요하다.

파일:

- `packages/shared/src/utils/curation-tags.ts`
- `packages/shared/src/config/interest-options.ts`
- `packages/web/src/app/api/admin/curation/crawl/route.ts`
- `packages/bot/src/scheduler-registry.ts`

`inferCurationTags`는 원본 태그, 제목, 설명을 보고 서비스 공통 관심사 태그(`INTEREST_OPTIONS`)로 정규화한다.

예시:

```text
raw: "rag", "embeddings", "pgvector"
-> LLM, 데이터베이스

title: "Building React Server Components"
-> 프론트엔드
```

태그 추론 순서:

1. raw tag가 공통 관심사 또는 alias와 정확히 맞는지 본다.
2. 제목/설명/raw tag 전체 텍스트에서 공통 관심사명을 찾는다.
3. 각 관심사의 alias 키워드를 찾는다.
4. 중복 제거 후 `maxTags`만큼 반환한다.

이미 크롤링된 큐레이션 아이템도 같은 규칙으로 백필했다. 자동으로 매칭되지 않는 아이템은 억지 태그를 넣지 않고 비워둔다.

---

## 큐레이션 추천 점수

파일:

- `packages/web/src/app/api/curation/route.ts`
- `packages/shared/src/ai/recommendation-score.ts`
- `packages/shared/src/ai/recommendation-reason.ts`

`/api/curation?sort=recommended`는 다음 조건이 맞으면 벡터 추천을 사용한다.

- 로그인 사용자가 Discord 계정으로 식별된다.
- `members`에 해당 Discord ID가 있다.
- `member_preference_embeddings`에 해당 멤버의 취향 벡터가 있다.

점수식:

```text
semanticScore = 1 - (curation_items.embedding <=> member_preference_embeddings.embedding)
freshnessScore = exp(-ageDays / 14.0)
normalizedRelevanceScore = clamp(curation_items.relevanceScore, 0, 100) / 100

finalScore =
  semanticScore * 0.65
  + freshnessScore * 0.20
  + normalizedRelevanceScore * 0.15
```

정렬:

```text
finalScore DESC
publishedAt DESC NULLS LAST
id DESC
```

`freshnessScore`는 14일을 기준으로 완만하게 감소한다. 오늘 올라온 글은 1에 가깝고, 오래된 글은 0에 가까워진다.

### 큐레이션 fallback

취향 임베딩이 없지만 `members.interests`가 있으면 태그 overlap 추천으로 fallback한다.

```text
overlapCount = curation_items.tags ∩ members.interests 개수
정렬 = overlapCount DESC, publishedAt DESC, id DESC
```

취향 임베딩도 관심사도 없으면 최신순으로 fallback한다.

### 큐레이션 cursor

추천순은 무한 스크롤에서 순서가 흔들리지 않도록 cursor에 `rankingAsOf` 시각을 포함한다.

```text
finalScore|publishedAt|id|rankingAsOfIso
```

다음 페이지에서도 같은 `rankingAsOf`로 최신성 점수를 계산하므로, 페이지를 넘기는 동안 시간이 흘러도 같은 랭킹 기준을 유지한다.

---

## 스터디 글 추천 점수

파일:

- `packages/web/src/app/api/posts/route.ts`
- `packages/web/src/app/(user)/posts/page.tsx`
- `packages/shared/src/ai/recommendation-reason.ts`

`/api/posts?sort=recommended`는 현재 사용자에게 취향 임베딩이 있을 때 추천 점수를 계산한다.

추천 탭에서는 본인 글은 제외한다.

```text
posts.memberId <> currentMemberId
```

점수식:

```text
semanticScore = 1 - (post_embeddings.embedding <=> member_preference_embeddings.embedding)
freshnessScore = exp(-ageDays / 14.0)
popularityScore = clamp((commentCount * 3 + viewCount * 2 + reactionCount) / 20, 0, 1)
authorAffinityScore =
  1.0 if 작성자 part == 현재 사용자 part
  0.5 if 작성자 interests와 현재 사용자 interests가 하나 이상 겹침
  0.0 otherwise

finalScore =
  semanticScore * 0.70
  + freshnessScore * 0.15
  + popularityScore * 0.10
  + authorAffinityScore * 0.05
```

현재 정렬은 다음 순서다.

```text
semanticScore DESC
finalScore DESC
publishedAt DESC
```

즉 포스트 추천은 종합점수보다 의미 유사도를 더 강하게 우선한다. 최신성/인기/작성자 친화도는 같은 유사도 구간 안에서 보정하는 성격이다.

### 추천 배지

프론트의 `PostRecommendationBadges`는 `recommendationReason`이 있을 때만 표시된다.

표시 내용:

- 한 줄 요약
- `관심도 {semanticScore}%`
- `최신성 {freshnessScore}%`
- `인기 {popularityScore}%`

`semanticScore`, `freshnessScore`, `popularityScore`가 모두 `null`이고 summary도 없으면 배지를 숨긴다.

추천 배지가 안 뜨는 대표 원인:

1. 현재 로그인 멤버의 `member_preference_embeddings`가 없다.
2. 추천 탭이 아니라 최신순/인기순 탭이다.
3. API가 `sort=recommended`로 호출되지 않았다.
4. 로그인 Discord ID와 `members.discord_id`가 연결되지 않았다.

이 브랜치에서 백필 대상이 `active`만이던 것을 `active`, `ob`, `dormant`로 넓힌 이유가 1번 때문이다. 추천 화면에서 볼 수 있는 멤버군은 모두 취향 임베딩을 가져야 배지가 안정적으로 뜬다.

---

## 추천 이유 생성

추천 이유는 LLM으로 매번 생성하지 않는다. 점수 계산에 사용한 구조화된 신호로 deterministic하게 만든다.

파일:

- `packages/shared/src/ai/recommendation-reason.ts`

공통 규칙:

1. 사용자 관심사가 제목/설명/태그와 직접 매칭되면 관심사 이유를 만든다.
2. `semanticScore >= 0.6`이면 의미 유사도 이유를 만든다.
3. `freshnessScore >= 0.6`이면 최신 글 이유를 만든다.
4. 큐레이션은 `relevanceScore >= 0.6`이면 스터디 키워드 관련도 이유를 만든다.
5. 포스트는 `authorAffinityScore >= 0.9`이고 파트가 같으면 같은 파트 이유를 만든다.
6. 포스트는 `popularityScore >= 0.3`이면 반응이 있는 글 이유를 만든다.

응답 형태:

```ts
recommendationReason: {
  summary: string;
  reasons: string[];
  matchedKeywords: string[];
  semanticScore: number | null;
  freshnessScore: number | null;
  relevanceScore?: number | null;
  popularityScore?: number | null;
  authorAffinityScore?: number | null;
}
```

예시:

```json
{
  "summary": "관심도 76%로 추천됐어요.",
  "reasons": [
    "프로필 관심사와 의미적으로 가까운 글이에요.",
    "같은 Backend 파트의 글이에요.",
    "조회, 댓글, 리액션 반응이 있는 글이에요."
  ],
  "matchedKeywords": [],
  "semanticScore": 0.76,
  "freshnessScore": 0.12,
  "popularityScore": 0.45,
  "authorAffinityScore": 1
}
```

---

## 백필 스크립트

파일:

- `packages/bot/src/scripts/backfill-curation-embeddings.ts`
- `packages/bot/src/scripts/backfill-post-embeddings.ts`
- `packages/bot/src/scripts/backfill-member-preference-embeddings.ts`

명령:

```bash
pnpm --filter @blog-study/bot backfill-curation-embeddings
pnpm --filter @blog-study/bot backfill-post-embeddings
pnpm --filter @blog-study/bot backfill-member-preference-embeddings
```

용도:

- 배포 전 기존 데이터에 임베딩을 채운다.
- 임베딩 서버 장애나 내부 API 실패로 누락된 데이터를 복구한다.
- 임베딩 텍스트 생성 규칙이 바뀐 뒤 재생성할 때 사용한다.

현재 `backfillMissingPosts`는 `post_embeddings`가 없거나 `embedded_at`이 없는 글만 처리한다. 해시가 달라진 stale embedding까지 자동 재생성하려면 별도 조건 추가가 필요하다.

---

## 마이그레이션

파일:

- `packages/shared/src/db/migrate-curation-embeddings.ts`
- `packages/shared/src/db/migrate-post-embeddings.ts`

큐레이션 마이그레이션:

- `extensions` schema 생성
- `vector` 확장 활성화
- 운영 DB에 `original_articles`만 있으면 `curation_items`로 rename
- `curation_items`에 임베딩 컬럼 추가
- `member_preference_embeddings` 생성
- HNSW 인덱스 생성
- 호환용 `original_articles` view 생성

포스트 마이그레이션:

- `vector` 확장 활성화
- `post_embeddings` 생성
- HNSW 인덱스 생성

인덱스:

```sql
USING hnsw (embedding extensions.vector_cosine_ops)
```

추천 쿼리는 코사인 거리 연산자 `<=>`를 사용한다.

---

## 운영 체크 쿼리

### 포스트 임베딩 커버리지

```sql
select
  count(*) filter (where p.deleted_at is null) as active_posts,
  count(pe.post_id) filter (where p.deleted_at is null) as active_embedded,
  count(*) filter (where p.deleted_at is null and pe.post_id is null) as active_missing
from posts p
left join post_embeddings pe on pe.post_id = p.id;
```

### 취향 임베딩 커버리지

```sql
select
  count(*) filter (where m.status in ('active','ob','dormant')) as recommendable_members,
  count(mpe.member_id) filter (where m.status in ('active','ob','dormant')) as pref_embedded,
  count(*) filter (
    where m.status in ('active','ob','dormant')
      and mpe.member_id is null
  ) as pref_missing
from members m
left join member_preference_embeddings mpe on mpe.member_id = m.id;
```

### 추천 점수 null 확인

```sql
with pairs as (
  select
    viewer.id as viewer_id,
    p.id as post_id,
    1 - (pe.embedding <=> mpe.embedding) as semantic_score
  from members viewer
  join member_preference_embeddings mpe on mpe.member_id = viewer.id
  join posts p on p.deleted_at is null and p.member_id <> viewer.id
  join post_embeddings pe on pe.post_id = p.id
  where viewer.status in ('active','ob','dormant')
)
select
  count(*) as pairs,
  count(*) filter (where semantic_score is null) as semantic_nulls,
  min(semantic_score) as min_semantic,
  max(semantic_score) as max_semantic
from pairs;
```

### 큐레이션 임베딩 커버리지

```sql
select
  count(*) as total_items,
  count(*) filter (where embedding is not null and embedded_at is not null) as embedded_items,
  count(*) filter (where embedding is null or embedded_at is null) as missing_items
from curation_items;
```

---

## 장애와 fallback

### 임베딩 서버 장애

글 등록, 프로필 저장, 큐레이션 수집 자체는 실패시키지 않는다. 임베딩 갱신은 `after()`와 봇 내부 API로 분리되어 있고, 실패하면 로그만 남긴다.

복구:

```bash
pnpm --filter @blog-study/bot backfill-member-preference-embeddings
pnpm --filter @blog-study/bot backfill-post-embeddings
pnpm --filter @blog-study/bot backfill-curation-embeddings
```

### 취향 임베딩 없음

- 큐레이션: 관심사 태그 overlap 추천으로 fallback한다.
- 포스트: 추천 점수를 계산하지 못하므로 기본 정렬로 fallback한다.

### 글 임베딩 없음

추천 쿼리에서 `coalesce(1 - distance, 0)` 형태로 semantic score가 0에 가깝게 처리된다. 추천 품질은 낮아지지만 API는 깨지지 않는다.

### 태그 없음

벡터 추천은 태그가 없어도 동작한다. 다만 추천 이유의 `matchedKeywords`와 태그 필터 품질이 낮아진다. 그래서 큐레이션 수집 시 `inferCurationTags`로 가능한 태그를 자동 보강한다.

---

## 관련 파일

공유 로직:

- `packages/shared/src/ai/embedding-text.ts`
- `packages/shared/src/ai/recommendation-score.ts`
- `packages/shared/src/ai/recommendation-reason.ts`
- `packages/shared/src/utils/curation-tags.ts`

DB/마이그레이션:

- `packages/shared/src/db/schema.ts`
- `packages/shared/src/db/migrate-curation-embeddings.ts`
- `packages/shared/src/db/migrate-post-embeddings.ts`

봇/임베딩:

- `packages/bot/src/services/embedding.service.ts`
- `packages/bot/src/api-server.ts`
- `packages/bot/src/scripts/backfill-curation-embeddings.ts`
- `packages/bot/src/scripts/backfill-post-embeddings.ts`
- `packages/bot/src/scripts/backfill-member-preference-embeddings.ts`

웹 API:

- `packages/web/src/app/api/curation/route.ts`
- `packages/web/src/app/api/posts/route.ts`
- `packages/web/src/app/api/profile/onboarding/route.ts`
- `packages/web/src/app/api/profile/edit/route.ts`
- `packages/web/src/app/api/posts/manual/route.ts`
- `packages/web/src/app/api/admin/curation/crawl/route.ts`
- `packages/web/src/lib/embedding-refresh.ts`

웹 UI:

- `packages/web/src/app/(user)/curation/page.tsx`
- `packages/web/src/app/(user)/posts/page.tsx`
