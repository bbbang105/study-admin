# 큐레이션 벡터 추천 구현 계획

**목표:** `/curation`의 `sort=recommended`를 지금처럼 `관심사 태그 ∩ 아이템 태그`로 정렬하는 방식에서, 사용자 취향 임베딩과 글 임베딩의 유사도로 빠르게 랭킹하는 방식으로 바꾼다.

**큰 방향:**  
RSS나 관리자 크롤링으로 큐레이션 글이 들어오면 `title + description + tags + sourceName`을 하나의 문장으로 만들고 임베딩을 저장한다. 사용자도 `part + interests + bio`를 취향 문장으로 만들고 임베딩을 저장한다. 추천 피드는 두 벡터의 코사인 유사도에 최신성과 기존 `relevanceScore`를 섞어 정렬한다.

---

## 지금 상태

- 코드에는 `curation_items` 테이블이 있다고 되어 있다.
- 그런데 실제 Supabase에는 `curation_items`가 없고, 비슷한 역할의 `original_articles` 테이블이 있다.
- Supabase에 `vector` 확장이 아직 켜져 있지 않다.
- 현재 `/api/curation?sort=recommended`는 `members.interests`와 `curation_items.tags`의 겹치는 개수로 정렬한다.
- 실제 DB의 큐레이션 글은 대부분 `tags`가 비어 있어서, 지금 방식은 추천 품질이 잘 나오기 어렵다.
- Supabase에서 RLS가 꺼져 있다는 보안 경고가 있다. 다만 RLS는 잘못 켜면 서비스가 막힐 수 있어서 이번 추천 기능과 분리해서 별도 작업으로 다룬다.

---

## 추천 점수

기본 점수식은 이렇게 간다.

```text
최종 추천 점수 =
  의미 유사도 65%
  + 최신성 20%
  + 기존 relevanceScore 15%
```

SQL 개념은 이렇다.

```sql
semantic_score = 1 - (item.embedding <=> user.embedding)
freshness_score = exp(-age_days / 14.0)
relevance_score = relevance_score를 0~1 사이로 정규화

final_score =
  semantic_score * 0.65 +
  freshness_score * 0.20 +
  relevance_score * 0.15
```

추천 모델은 로컬에서 돌릴 수 있는 Ollama `nomic-embed-text`를 기준으로 잡는다.

- 차원: `768`
- DB 타입: `vector(768)`
- 외부 LLM API 호출 비용이 없다.
- 로컬/사내망에서 임베딩을 만들 수 있다.
- Supabase `pgvector`의 HNSW 인덱스를 쓰기 좋다.

필요한 환경변수:

```bash
EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
```

로컬 준비 예시:

```bash
ollama pull nomic-embed-text
ollama serve
```

운영에서 Docker 봇이 Ollama에 접근해야 하면 `localhost`가 아니라 같은 네트워크에서 접근 가능한 URL을 넣는다.

---

## 추천 이유

추천 이유는 “AI가 매번 문장을 생성”하지 않는다. 대신 추천 점수를 계산할 때 이미 알 수 있는 근거를 구조화해서 내려준다.

예시:

```text
관심사 React와 성능 최적화에 잘 맞아요.
최근 7일 안에 올라온 글이에요.
Frontend Weekly에서 가져온 글이에요.
```

추천 이유 후보:

1. **관심사 기반 이유**
   - 사용자 `interests`와 아이템 `tags/title/description`에서 겹치거나 가까운 키워드를 찾는다.
   - 예: `React`, `성능 최적화`, `Next.js`

2. **파트 기반 이유**
   - 사용자 `part`가 `Frontend`이고 글이 React/브라우저/UI/성능 쪽이면 표시한다.
   - 예: `프론트엔드 파트 관심 주제와 가까워요.`

3. **최신성 이유**
   - `publishedAt`이 최근이면 표시한다.
   - 예: `최근 3일 안에 올라온 글이에요.`

4. **기존 relevanceScore 이유**
   - `relevanceScore`가 높으면 표시한다.
   - 예: `스터디 키워드 관련도가 높은 글이에요.`

5. **소스 이유**
   - 신뢰할 수 있는 큐레이션 소스명이 있으면 표시한다.
   - 예: `Frontend Weekly에서 가져온 글이에요.`

API 응답에는 이렇게 붙인다.

```ts
recommendationReason: {
  summary: string;
  reasons: string[];
  matchedKeywords: string[];
  semanticScore: number | null;
  freshnessScore: number | null;
  relevanceScore: number | null;
}
```

프론트에서는 카드에 한 줄 요약만 보여주고, 필요하면 작은 tooltip/drawer에서 세부 이유를 보여준다.

예시 응답:

```json
{
  "summary": "React와 성능 최적화 관심사에 잘 맞아요.",
  "reasons": [
    "관심사 React와 연결돼요.",
    "최근 7일 안에 올라온 글이에요.",
    "스터디 키워드 관련도가 높은 글이에요."
  ],
  "matchedKeywords": ["React", "성능 최적화"],
  "semanticScore": 0.82,
  "freshnessScore": 0.71,
  "relevanceScore": 0.64
}
```

이 방식의 장점:

- 매 요청마다 LLM을 부르지 않아서 빠르고 싸다.
- 같은 조건에서는 같은 추천 이유가 나온다.
- 추천 이유가 실제 점수 계산과 연결되어 있어서 납득 가능하다.
- 나중에 클릭/저장/숨김 데이터를 섞어도 이유 규칙을 확장하기 쉽다.

---

## 작업 1. 큐레이션 테이블 이름 정리

**왜 필요한가:**  
코드는 `curation_items`를 보는데, 실제 DB는 `original_articles`를 쓰고 있다. 이 상태에서 추천 기능을 얹으면 로컬과 운영이 계속 어긋난다.

**할 일:**

1. 실제 DB에 `curation_items`가 없는지 확인한다.
2. `original_articles`를 `curation_items`로 이름 변경한다.
3. 혹시 기존 운영 코드가 `original_articles`를 보고 있을 가능성을 대비해서 임시 view를 둔다.

예상 SQL:

```sql
alter table if exists public.original_articles rename to curation_items;

alter index if exists idx_original_articles_is_shared rename to idx_curation_items_is_shared;
alter index if exists idx_original_articles_published_at rename to idx_curation_items_published_at;

create or replace view public.original_articles as
select * from public.curation_items;
```

검증:

```sql
select to_regclass('public.curation_items'), count(*)
from public.curation_items;
```

---

## 작업 2. pgvector 스키마 추가

**왜 필요한가:**  
글과 사용자 취향을 벡터로 저장해야 추천 정렬을 빠르게 할 수 있다.

**할 일:**

1. Supabase에 `vector` 확장을 켠다.
2. `curation_items`에 임베딩 컬럼을 추가한다.
3. 사용자 취향 임베딩용 새 테이블을 만든다.
4. HNSW 인덱스를 만든다.

추가할 컬럼:

```text
curation_items.embedding
curation_items.embedding_text_hash
curation_items.embedding_model
curation_items.embedded_at
```

새 테이블:

```text
member_preference_embeddings
- member_id
- preference_text
- preference_text_hash
- embedding
- embedding_model
- refreshed_at
```

핵심 SQL:

```sql
create extension if not exists vector with schema extensions;

create index if not exists idx_curation_items_embedding_hnsw
on public.curation_items
using hnsw (embedding extensions.vector_cosine_ops)
where embedding is not null;

create index if not exists idx_member_preference_embeddings_embedding_hnsw
on public.member_preference_embeddings
using hnsw (embedding extensions.vector_cosine_ops);
```

---

## 작업 3. 임베딩용 텍스트 생성 함수 만들기

**왜 필요한가:**  
임베딩 품질은 “어떤 문장을 임베딩하느냐”에 크게 좌우된다. 매번 제멋대로 만들지 말고 같은 규칙으로 만들어야 한다.

**파일:**

```text
packages/shared/src/ai/embedding-text.ts
```

아이템 임베딩 문장 예시:

```text
Title: React Server Components 성능 최적화
Description: Streaming과 cache 전략 정리
Tags: React, Performance
Source: Frontend Weekly
```

사용자 취향 문장 예시:

```text
Backend 개발자. 관심사: React, 성능 최적화. 소개: API와 DB 성능을 좋아합니다.
```

같은 문장이면 다시 임베딩하지 않도록 `sha256` 해시도 같이 만든다.

---

## 작업 4. 임베딩 생성 서비스 만들기

**왜 필요한가:**  
크롤링, 백필, 프로필 수정 등 여러 곳에서 임베딩 생성이 필요하므로 공통 서비스로 빼야 한다.

**파일:**

```text
packages/bot/src/services/embedding.service.ts
```

기능:

- 글 하나의 임베딩 생성/저장
- 멤버 한 명의 취향 임베딩 생성/저장
- 임베딩이 없는 큐레이션 글 일괄 백필

주의:

- 로컬 임베딩 서버에 연결할 수 없으면 실패하지 않고 그냥 skip한다.
- 외부 API 호출이므로 크롤링 요청을 오래 붙잡지 않게 비동기로 처리한다.

---

## 작업 5. 크롤링 후 새 글 임베딩 생성

**왜 필요한가:**  
새 큐레이션 글이 들어왔는데 임베딩이 없으면 추천 피드에 바로 반영되지 않는다.

**수정할 곳:**

```text
packages/bot/src/services/curation.service.ts
packages/web/src/app/api/admin/curation/crawl/route.ts
```

방식:

- 봇 크롤링 경로에서는 새 글 insert 후 `refreshCurationItem(item.id)`를 비동기로 호출한다.
- 관리자 수동 크롤링 경로는 SSE 응답을 막지 않도록, 우선 insert된 ID만 모으고 백필 스크립트로 보완한다.
- 나중에 필요하면 내부 API/큐로 관리자 크롤링도 즉시 임베딩 처리한다.

---

## 작업 6. 사용자 취향 임베딩 갱신

**왜 필요한가:**  
사용자가 온보딩하거나 프로필에서 관심사/bio/part를 바꾸면 추천 취향도 바뀌어야 한다.

**수정할 곳:**

```text
packages/web/src/app/api/profile/onboarding/route.ts
packages/web/src/app/api/profile/edit/route.ts
```

방식:

- 프로필 저장 후 내부 API나 봇 API를 통해 해당 멤버의 취향 임베딩을 갱신한다.
- 즉시 갱신이 실패해도 서비스는 계속 동작한다.
- 실패/누락분은 백필 스크립트로 보완한다.

---

## 작업 7. `/api/curation?sort=recommended` 정렬 교체

**왜 필요한가:**  
실제 사용자에게 보이는 추천 품질이 바뀌는 핵심 작업이다.

**파일:**

```text
packages/web/src/app/api/curation/route.ts
```

처리 흐름:

1. 로그인한 사용자의 Discord ID를 찾는다.
2. `members`에서 멤버를 찾는다.
3. `member_preference_embeddings`에서 사용자 취향 벡터를 찾는다.
4. 벡터가 있으면 벡터 추천 정렬을 쓴다.
5. 벡터가 없으면 기존 태그 오버랩 추천을 쓴다.
6. 관심사도 없으면 최신순으로 fallback한다.

정렬:

```sql
order by final_score desc, published_at desc nulls last, id desc
```

커서:

```text
final_score|published_at|id
```

기존 기능 유지:

- 카테고리 필터 유지
- 태그 필터 유지
- 검색 유지
- 무한 스크롤 유지
- 최신순 정렬 유지

---

## 작업 8. 추천 이유 생성 및 응답 추가

**왜 필요한가:**  
사용자는 “왜 이 글이 나한테 추천됐는지”를 알아야 추천을 신뢰할 수 있다. 다만 매번 AI 추천문을 생성하면 느리고 비싸므로, 점수 계산에 사용한 근거로 설명을 만든다.

**파일:**

```text
packages/shared/src/ai/recommendation-reason.ts
packages/shared/src/ai/recommendation-reason.property.test.ts
packages/web/src/app/api/curation/route.ts
packages/web/src/app/(user)/curation/page.tsx
```

생성 규칙:

```text
1순위: matchedKeywords가 있으면 “React와 성능 최적화 관심사에 잘 맞아요.”
2순위: semanticScore가 높으면 “프로필 관심사와 의미적으로 가까운 글이에요.”
3순위: freshnessScore가 높으면 “최근 올라온 글이에요.”
4순위: relevanceScore가 높으면 “스터디 키워드 관련도가 높은 글이에요.”
5순위: sourceName이 있으면 “{sourceName}에서 가져온 글이에요.”
```

API 응답 필드:

```ts
recommendationReason: {
  summary: string;
  reasons: string[];
  matchedKeywords: string[];
  semanticScore: number | null;
  freshnessScore: number | null;
  relevanceScore: number | null;
}
```

화면 표시:

- 큐레이션 카드/리스트에 한 줄만 작게 표시한다.
- 예: `React와 성능 최적화 관심사에 잘 맞아요.`
- 세부 점수는 기본 UI에 노출하지 않는다.
- 디버깅이 필요하면 개발 모드에서만 console이나 hidden data로 확인한다.

현재 UI 기준 구체 위치:

- 모바일/태블릿 카드: 제목 아래, 설명 위에 추천 이유 한 줄을 넣는다.
- 데스크톱 리스트: 설명 아래, 메타 정보 줄 위에 추천 이유 한 줄을 넣는다.
- `sort=recommended`일 때만 보여준다.
- `전체`, `컨퍼런스`, `아티클`, 검색 결과처럼 추천 정렬이 아닌 화면에서는 숨긴다.
- 아이콘은 기존 `Sparkles`를 재사용한다.
- 색은 과하게 강조하지 않고 `text-primary` 또는 `text-muted-foreground` 안에서 처리한다.
- 추천 이유가 길면 `line-clamp-1`로 한 줄 처리한다.

예상 UI:

```tsx
{
  showRecommendationReason && item.recommendationReason?.summary && (
    <p className="inline-flex items-center gap-1 text-xs font-medium text-primary line-clamp-1">
      <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
      {item.recommendationReason.summary}
    </p>
  );
}
```

타입도 같이 확장한다.

```ts
interface RecommendationReason {
  summary: string;
  reasons: string[];
  matchedKeywords: string[];
  semanticScore: number | null;
  freshnessScore: number | null;
  relevanceScore: number | null;
}

interface CurationItemResponse {
  // 기존 필드 유지
  recommendationReason: RecommendationReason | null;
}
```

fallback:

- 벡터 추천이 아니면 `semanticScore`는 `null`로 내려준다.
- 태그 오버랩 추천에서는 `matchedKeywords` 중심으로 이유를 만든다.
- 최신순 fallback에서는 `최근 올라온 글이에요.` 정도만 표시하거나 이유를 생략한다.

---

## 작업 9. 기존 데이터 백필 스크립트 추가

**왜 필요한가:**  
이미 DB에 들어가 있는 글과 멤버는 크롤링/프로필 저장 이벤트가 다시 발생하지 않으므로 따로 임베딩을 채워야 한다.

**파일:**

```text
packages/bot/src/scripts/backfill-curation-embeddings.ts
packages/bot/src/scripts/backfill-member-preference-embeddings.ts
```

명령어:

```bash
pnpm --filter @blog-study/bot backfill-member-preference-embeddings
pnpm --filter @blog-study/bot backfill-curation-embeddings 100
```

검증:

```sql
select count(*) filter (where embedding is not null)
from public.curation_items;

select count(*)
from public.member_preference_embeddings;
```

---

## 작업 10. 검증

**타입 검사:**

```bash
pnpm --filter @blog-study/shared typecheck
pnpm --filter @blog-study/bot typecheck
pnpm --filter @blog-study/web typecheck
```

**DB 확인:**

```sql
select extname, extversion
from pg_extension
where extname = 'vector';
```

**추천 쿼리 확인:**

```sql
select
  ci.id,
  ci.title,
  1 - (ci.embedding <=> mpe.embedding) as semantic_score
from public.curation_items ci
join public.member_preference_embeddings mpe
  on mpe.member_id = '<member-id>'::uuid
where ci.embedding is not null
order by semantic_score desc
limit 10;
```

**웹 확인:**

```text
/curation?sort=recommended
```

확인할 것:

- 추천 피드가 뜬다.
- 무한 스크롤이 된다.
- 검색이 된다.
- 카테고리/태그 필터가 된다.
- 임베딩 없는 유저도 오류 없이 fallback된다.

---

## 배포 순서

1. DB 테이블명 정리
2. `vector` 확장과 임베딩 컬럼 추가
3. fallback 포함한 코드 배포
4. 멤버 취향 임베딩 백필
5. 큐레이션 글 임베딩 백필
6. 추천 이유 응답과 화면 표시 배포
7. `/curation?sort=recommended` 모니터링
8. 오류/지연 시간이 괜찮으면 벡터 추천을 기본 추천으로 유지

---

## 임베딩 서버 트러블슈팅

이번 구성은 다음 구조다.

```text
봇/로컬 개발 환경
  -> https://embedding.hozorica.com
  -> Cloudflare Access Service Token
  -> Cloudflare Tunnel
  -> GCE VM localhost:11434
  -> Ollama nomic-embed-text
```

### 1. Ollama 로컬 확인

GCE VM 안에서 먼저 확인한다.

```bash
curl http://localhost:11434/api/tags
```

정상 예시:

```json
{
  "models": [
    {
      "name": "nomic-embed-text:latest"
    }
  ]
}
```

임베딩 확인:

```bash
curl http://localhost:11434/api/embed \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": "React 성능 최적화"
  }'
```

정상 조건:

```text
embeddings[0].length = 768
```

첫 요청은 모델 로딩 때문에 10~30초 걸릴 수 있다. 두 번째 요청부터 빨라지는지 확인한다.

### 2. Cloudflare Tunnel 확인

VM에서 foreground로 테스트:

```bash
sudo cloudflared tunnel --config /etc/cloudflared/config.yml run
```

정상 로그:

```text
Registered tunnel connection
```

서비스 상태:

```bash
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 80 --no-pager
```

### 3. Cloudflare Access 403 확인

외부에서 service token 없이 호출하면 403이 정상이다.

```bash
curl -i https://embedding.hozorica.com/api/tags
```

service token을 붙였는데도 403이면 Cloudflare Access 정책을 확인한다.

정책 설정:

```text
Application: embedding.hozorica.com
Policy action: Service Auth
Include: Service Token
```

Cloudflare 로그 위치:

```text
Zero Trust -> Logs -> Access -> Access 인증 로그
```

주의:

- 로그 화면에서 `서비스 인증 같음 제외` 필터가 켜져 있으면 service token 요청이 숨겨진다.
- 필터를 지우고 확인한다.
- Access 로그에 `Allowed`가 뜨면 Access는 통과한 것이다.

### 4. Access는 Allowed인데 curl이 403인 경우

이 경우 Cloudflare Access가 아니라 origin인 Ollama가 막았을 가능성이 높다.

원인:

```text
Cloudflare Tunnel이 Host: embedding.hozorica.com 헤더를 origin에 전달
Ollama가 예상하지 않은 Host 헤더를 403 처리
```

해결:

```bash
sudo vim /etc/cloudflared/config.yml
```

`originRequest.httpHostHeader`를 추가한다.

```yaml
tunnel: baa77ccf-c3ea-43a6-b102-505c4f53edb0
credentials-file: /etc/cloudflared/baa77ccf-c3ea-43a6-b102-505c4f53edb0.json

ingress:
  - hostname: embedding.hozorica.com
    service: http://localhost:11434
    originRequest:
      httpHostHeader: localhost:11434
  - service: http_status:404
```

재시작:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager
```

확인:

```bash
curl -i https://embedding.hozorica.com/api/tags \
  -H "CF-Access-Client-Id: $EMBEDDING_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $EMBEDDING_ACCESS_CLIENT_SECRET"
```

정상:

```text
HTTP/2 200
```

### 5. 최종 외부 임베딩 테스트

```bash
curl -i https://embedding.hozorica.com/api/embed \
  -H "CF-Access-Client-Id: $EMBEDDING_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $EMBEDDING_ACCESS_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": "React 성능 최적화"
  }'
```

정상 조건:

```text
HTTP 200
model = nomic-embed-text
embedding_count = 1
dimensions = 768
```

### 6. 운영 env

로컬 개발 `.env`와 운영 봇 EC2 `.env`에 같은 값이 필요하다.

```bash
EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=https://embedding.hozorica.com
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
EMBEDDING_ACCESS_CLIENT_ID=...
EMBEDDING_ACCESS_CLIENT_SECRET=...
```

`EMBEDDING_ACCESS_CLIENT_ID`와 `EMBEDDING_ACCESS_CLIENT_SECRET`은 Cloudflare Access service token이다. 채팅이나 로그에 노출되면 rotate한다.

---

## 완료 기준

- 최신순 정렬은 기존과 동일하게 동작한다.
- 추천 정렬은 임베딩이 있으면 벡터 유사도 기반으로 동작한다.
- 임베딩이 없으면 기존 방식이나 최신순으로 안전하게 fallback한다.
- 새로 크롤링된 글은 임베딩 생성 대상이 된다.
- 프로필 변경 후 사용자 취향 임베딩이 갱신된다.
- 추천 이유가 API 응답에 포함되고 화면에 한 줄로 표시된다.
- 기존 데이터 백필 스크립트가 동작한다.
- Supabase에 HNSW 벡터 인덱스가 있다.
- shared, bot, web 타입 체크가 통과한다.

---

## 별도 보안 작업

이번 추천 기능과 별개로 Supabase RLS를 꼭 정리해야 한다.

추천 기능은 `members.bio`, `members.interests`, 취향 문장 같은 개인 데이터를 더 적극적으로 쓰게 된다. 지금 Supabase advisory 기준으로는 public 테이블 RLS가 꺼져 있으므로, 운영 확장 전에 별도 계획으로 처리하는 게 좋다.

다만 RLS는 정책 없이 켜면 앱이 바로 막힐 수 있으니 추천 기능 마이그레이션에 섞지 않는다.
