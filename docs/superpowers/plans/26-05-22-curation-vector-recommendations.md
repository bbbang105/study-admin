# Curation Vector Recommendations Implementation Plan

> Note: The Korean plan is the authoritative current version for implementation. The embedding provider was changed from OpenAI SDK to a local Ollama-compatible embedding endpoint after this draft was written.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/api/curation?sort=recommended` tag-overlap sorting with fast vector similarity ranking using Supabase pgvector, while keeping latest/tag/search filters and a safe fallback path.

**Architecture:** Store embeddings for curation items and member preference profiles in Postgres via `pgvector`. Generate item embeddings when RSS/admin crawlers insert new items, generate member preference embeddings from `interests + bio + part`, and rank recommended feed items by semantic similarity blended with freshness and existing `relevanceScore`. Keep the existing latest sort unchanged and fall back to tag-overlap/latest when vectors are missing.

**Tech Stack:** Next.js 16 route handlers, Drizzle ORM, Supabase Postgres + pgvector, Node 22, pnpm, Vitest, OpenAI-compatible embeddings provider.

---

## Current Findings

- Local code expects `curation_items` in `packages/shared/src/db/schema.ts`.
- Connected Supabase currently has `public.original_articles` with curation-item-shaped columns, not `public.curation_items`.
- Connected Supabase does not have the `vector` extension enabled yet.
- Existing `/api/curation?sort=recommended` reads `members.interests` and ranks by `interests ∩ curation_items.tags`.
- Production DB has many curation rows with empty `tags`, so semantic embedding is the right upgrade path.
- Supabase advisory reports RLS is disabled on public tables. Do not auto-enable RLS in the recommendation migration because it can block the app without policies; handle as a separate security task.

## File Map

- Modify: `packages/shared/src/db/schema.ts`
  - Add vector custom type if Drizzle version lacks native vector support.
  - Add embedding metadata fields to curation items.
  - Add `member_preference_embeddings` table.
- Create: `packages/shared/src/ai/embedding-text.ts`
  - Pure helpers that build deterministic embedding input text for items and members.
- Create: `packages/shared/src/ai/recommendation-score.ts`
  - Shared constants and score blend formula documentation/helpers.
- Modify: `packages/shared/src/index.ts`
  - Export AI helpers.
- Modify: `packages/shared/src/config/env.ts`
  - Add server-only embedding provider env vars.
- Create: `packages/bot/src/services/embedding.service.ts`
  - Generate embeddings, update item/member embedding rows, and backfill missing embeddings.
- Modify: `packages/bot/src/services/curation.service.ts`
  - Queue or directly trigger item embedding generation after new items are inserted.
- Modify: `packages/web/src/app/api/admin/curation/crawl/route.ts`
  - Trigger item embedding generation after admin crawl inserts.
- Modify: `packages/web/src/app/api/profile/onboarding/route.ts`
  - Refresh member preference embedding after onboarding.
- Modify: `packages/web/src/app/api/profile/edit/route.ts`
  - Refresh member preference embedding after profile edits.
- Modify: `packages/web/src/app/api/curation/route.ts`
  - Replace recommended sort with vector score query and cursor pagination.
- Create: `packages/bot/src/scripts/backfill-curation-embeddings.ts`
  - Backfill missing curation item embeddings.
- Create: `packages/bot/src/scripts/backfill-member-preference-embeddings.ts`
  - Backfill missing member preference embeddings.
- Test: `packages/shared/src/ai/embedding-text.property.test.ts`
  - Verify stable text construction.
- Test: `packages/shared/src/ai/recommendation-score.property.test.ts`
  - Verify bounded score behavior.
- Test: `packages/web/src/app/api/curation/route.test.ts`
  - Verify fallback and SQL cursor behavior using mocked db calls, if route test harness exists; otherwise use a focused helper test.

## Recommended Embedding Model Decision

Use local Ollama `nomic-embed-text` by default:

- Dimension: `768`
- Good enough for short article/member profile text.
- Lower cost than larger embedding models.
- Fits pgvector HNSW index limit for standard `vector`.

Environment variables:

```bash
EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
```

If a non-OpenAI provider is preferred later, keep the service interface provider-neutral and only swap the API client implementation.

## Score Formula

Use cosine similarity from pgvector:

```sql
semantic_score = 1 - (item.embedding <=> member_pref.embedding)
freshness_score = exp(-age_days / 14.0)
normalized_relevance_score = least(greatest(coalesce(relevance_score, 0), 0), 100) / 100.0

final_score =
  semantic_score * 0.65 +
  freshness_score * 0.20 +
  normalized_relevance_score * 0.15
```

Reasoning:

- Semantic match should dominate.
- Freshness prevents excellent but stale items from pinning the top forever.
- Existing relevance score remains useful as a weak prior.

Cursor fields:

```text
final_score|published_at|id
```

Use `id` as deterministic tie-breaker.

---

### Task 1: Reconcile Curation Table Name Before Feature Work

**Files:**

- Inspect: `packages/shared/src/db/schema.ts`
- Inspect: Supabase tables `public.original_articles`, `public.curation_items`
- Modify only if needed: generated Drizzle migration under `packages/shared/drizzle/`

- [ ] **Step 1: Verify local schema and remote table mismatch**

Run:

```bash
pnpm --filter @blog-study/shared typecheck
```

Expected:

```text
No TypeScript errors, or unrelated existing errors only.
```

Run against Supabase:

```sql
select to_regclass('public.curation_items') as curation_items,
       to_regclass('public.original_articles') as original_articles;
```

Expected current result:

```text
curation_items = null
original_articles = original_articles
```

- [ ] **Step 2: Decide the canonical table**

Use `curation_items` as canonical because repo code already imports `curationItems` and the user-facing feature is `/curation`.

Migration SQL for production convergence:

```sql
alter table if exists public.original_articles rename to curation_items;

alter index if exists idx_original_articles_is_shared rename to idx_curation_items_is_shared;
alter index if exists idx_original_articles_published_at rename to idx_curation_items_published_at;
```

If any existing production-only code still references `original_articles`, create a temporary compatibility view after rename:

```sql
create or replace view public.original_articles as
select * from public.curation_items;
```

- [ ] **Step 3: Verify convergence**

Run:

```sql
select to_regclass('public.curation_items') as curation_items,
       count(*)::int as rows
from public.curation_items;
```

Expected:

```text
curation_items = curation_items
rows > 0
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/drizzle packages/shared/src/db/schema.ts
git commit -m "chore: align curation table naming"
```

---

### Task 2: Add pgvector Schema

**Files:**

- Modify: `packages/shared/src/db/schema.ts`
- Generate: `packages/shared/drizzle/*`

- [ ] **Step 1: Add Drizzle vector custom type**

In `packages/shared/src/db/schema.ts`, extend imports:

```ts
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
```

Add near table declarations:

```ts
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string) {
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .filter(Boolean)
      .map(Number);
  },
});
```

- [ ] **Step 2: Add curation item embedding columns**

In `curationItems`, add:

```ts
    embedding: vector('embedding'),
    embeddingTextHash: varchar('embedding_text_hash', { length: 64 }),
    embeddingModel: varchar('embedding_model', { length: 100 }),
    embeddedAt: timestamp('embedded_at', { withTimezone: true }),
```

Add indexes:

```ts
    embeddedAtIdx: index('idx_curation_items_embedded_at').on(table.embeddedAt),
```

The HNSW vector index should be added with raw SQL in the generated migration because Drizzle index helpers may not support pgvector operator classes cleanly:

```sql
create extension if not exists vector with schema extensions;

create index if not exists idx_curation_items_embedding_hnsw
on public.curation_items
using hnsw (embedding extensions.vector_cosine_ops)
where embedding is not null;
```

- [ ] **Step 3: Add member preference embeddings table**

Add after `members`:

```ts
export const memberPreferenceEmbeddings = pgTable(
  'member_preference_embeddings',
  {
    memberId: uuid('member_id')
      .primaryKey()
      .references(() => members.id, { onDelete: 'cascade' }),
    preferenceText: text('preference_text').notNull(),
    preferenceTextHash: varchar('preference_text_hash', { length: 64 }).notNull(),
    embedding: vector('embedding').notNull(),
    embeddingModel: varchar('embedding_model', { length: 100 }).notNull(),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    refreshedAtIdx: index('idx_member_preference_embeddings_refreshed_at').on(table.refreshedAt),
  })
);
```

Add HNSW index SQL:

```sql
create index if not exists idx_member_preference_embeddings_embedding_hnsw
on public.member_preference_embeddings
using hnsw (embedding extensions.vector_cosine_ops);
```

- [ ] **Step 4: Generate and inspect migration**

Run:

```bash
pnpm --filter @blog-study/shared db:generate
```

Expected:

```text
New migration file created under packages/shared/drizzle/
```

Inspect the generated migration and manually add `create extension` plus HNSW index SQL if missing.

- [ ] **Step 5: Verify typecheck**

Run:

```bash
pnpm --filter @blog-study/shared typecheck
```

Expected:

```text
No TypeScript errors.
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/db/schema.ts packages/shared/drizzle
git commit -m "feat: add curation embedding schema"
```

---

### Task 3: Add Pure Embedding Text Helpers

**Files:**

- Create: `packages/shared/src/ai/embedding-text.ts`
- Create: `packages/shared/src/ai/embedding-text.property.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write tests**

Create `packages/shared/src/ai/embedding-text.property.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCurationItemEmbeddingText,
  buildMemberPreferenceText,
  sha256Text,
} from './embedding-text';

describe('embedding text helpers', () => {
  it('builds curation item text from stable fields', () => {
    expect(
      buildCurationItemEmbeddingText({
        title: 'React Server Components 성능 최적화',
        description: 'Streaming과 cache 전략 정리',
        tags: ['React', 'Performance'],
        sourceName: 'Frontend Weekly',
      })
    ).toBe(
      'Title: React Server Components 성능 최적화\nDescription: Streaming과 cache 전략 정리\nTags: React, Performance\nSource: Frontend Weekly'
    );
  });

  it('builds member preference text from profile fields', () => {
    expect(
      buildMemberPreferenceText({
        part: 'Backend',
        bio: 'API와 DB 성능을 좋아합니다.',
        interests: ['React', '성능 최적화'],
      })
    ).toBe('Backend 개발자. 관심사: React, 성능 최적화. 소개: API와 DB 성능을 좋아합니다.');
  });

  it('hashes text deterministically', () => {
    expect(sha256Text('same')).toBe(sha256Text('same'));
    expect(sha256Text('same')).not.toBe(sha256Text('different'));
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pnpm --filter @blog-study/shared test embedding-text.property.test.ts
```

Expected:

```text
FAIL because embedding-text module does not exist.
```

- [ ] **Step 3: Implement helper**

Create `packages/shared/src/ai/embedding-text.ts`:

```ts
import { createHash } from 'node:crypto';

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function buildCurationItemEmbeddingText(input: {
  title: string;
  description?: string | null;
  tags?: string[] | null;
  sourceName?: string | null;
}): string {
  const lines = [`Title: ${clean(input.title)}`];
  const description = clean(input.description);
  if (description) lines.push(`Description: ${description}`);
  if (input.tags?.length) lines.push(`Tags: ${input.tags.map(clean).filter(Boolean).join(', ')}`);
  const sourceName = clean(input.sourceName);
  if (sourceName) lines.push(`Source: ${sourceName}`);
  return lines.join('\n');
}

export function buildMemberPreferenceText(input: {
  part: string;
  bio?: string | null;
  interests?: string[] | null;
}): string {
  const part = clean(input.part);
  const interests = input.interests?.map(clean).filter(Boolean) ?? [];
  const bio = clean(input.bio);

  const segments = [`${part || '스터디'} 개발자.`];
  if (interests.length) segments.push(`관심사: ${interests.join(', ')}.`);
  if (bio) segments.push(`소개: ${bio}`);
  return segments.join(' ');
}
```

Modify `packages/shared/src/index.ts`:

```ts
export * from './ai/embedding-text';
```

- [ ] **Step 4: Verify tests**

Run:

```bash
pnpm --filter @blog-study/shared test embedding-text.property.test.ts
pnpm --filter @blog-study/shared typecheck
```

Expected:

```text
PASS embedding-text.property.test.ts
No TypeScript errors.
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/ai/embedding-text.ts packages/shared/src/ai/embedding-text.property.test.ts packages/shared/src/index.ts
git commit -m "feat: add embedding text helpers"
```

---

### Task 4: Add Embedding Service

**Files:**

- Modify: `packages/shared/src/config/env.ts`
- Create: `packages/bot/src/services/embedding.service.ts`
- Modify: `packages/bot/package.json`

- [ ] **Step 1: Add env validation**

In `packages/shared/src/config/env.ts`, add optional bot env vars:

```ts
EMBEDDING_PROVIDER: z.enum(['ollama', 'openai-compatible']).default('ollama'),
EMBEDDING_BASE_URL: z.string().url().default('http://localhost:11434'),
EMBEDDING_MODEL: z.string().min(1).default('nomic-embed-text'),
EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
EMBEDDING_API_KEY: z.string().min(1).optional(),
```

- [ ] **Step 2: Add OpenAI SDK dependency**

Run:

```bash
pnpm --filter @blog-study/bot add openai
```

Expected:

```text
openai added to @blog-study/bot dependencies.
```

- [ ] **Step 3: Implement service**

Create `packages/bot/src/services/embedding.service.ts`:

```ts
import OpenAI from 'openai';
import { eq, isNull, or } from 'drizzle-orm';
import {
  buildCurationItemEmbeddingText,
  buildMemberPreferenceText,
  sha256Text,
} from '@blog-study/shared';
import {
  curationItems,
  curationSources,
  getDb,
  memberPreferenceEmbeddings,
  members,
} from '@blog-study/shared/db';

const DEFAULT_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

export class EmbeddingService {
  private db = getDb();
  private client = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

  private async embed(text: string): Promise<number[] | null> {
    if (!this.client) return null;
    const response = await this.client.embeddings.create({
      model: DEFAULT_MODEL,
      input: text,
    });
    return response.data[0]?.embedding ?? null;
  }

  async refreshCurationItem(itemId: string): Promise<boolean> {
    const [row] = await this.db
      .select({
        id: curationItems.id,
        title: curationItems.title,
        description: curationItems.description,
        tags: curationItems.tags,
        sourceName: curationSources.name,
      })
      .from(curationItems)
      .leftJoin(curationSources, eq(curationItems.sourceId, curationSources.id))
      .where(eq(curationItems.id, itemId))
      .limit(1);

    if (!row) return false;

    const text = buildCurationItemEmbeddingText(row);
    const hash = sha256Text(text);
    const embedding = await this.embed(text);
    if (!embedding) return false;

    await this.db
      .update(curationItems)
      .set({
        embedding,
        embeddingTextHash: hash,
        embeddingModel: DEFAULT_MODEL,
        embeddedAt: new Date(),
      })
      .where(eq(curationItems.id, itemId));

    return true;
  }

  async refreshMemberPreference(memberId: string): Promise<boolean> {
    const [member] = await this.db
      .select({
        id: members.id,
        part: members.part,
        bio: members.bio,
        interests: members.interests,
      })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);

    if (!member) return false;

    const preferenceText = buildMemberPreferenceText(member);
    const preferenceTextHash = sha256Text(preferenceText);
    const embedding = await this.embed(preferenceText);
    if (!embedding) return false;

    await this.db
      .insert(memberPreferenceEmbeddings)
      .values({
        memberId,
        preferenceText,
        preferenceTextHash,
        embedding,
        embeddingModel: DEFAULT_MODEL,
        refreshedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: memberPreferenceEmbeddings.memberId,
        set: {
          preferenceText,
          preferenceTextHash,
          embedding,
          embeddingModel: DEFAULT_MODEL,
          refreshedAt: new Date(),
        },
      });

    return true;
  }

  async backfillMissingCurationItems(limit = 50): Promise<number> {
    const rows = await this.db
      .select({ id: curationItems.id })
      .from(curationItems)
      .where(or(isNull(curationItems.embedding), isNull(curationItems.embeddedAt)))
      .limit(limit);

    let updated = 0;
    for (const row of rows) {
      if (await this.refreshCurationItem(row.id)) updated++;
    }
    return updated;
  }
}

let embeddingService: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  embeddingService ??= new EmbeddingService();
  return embeddingService;
}
```

- [ ] **Step 4: Verify typecheck**

Run:

```bash
pnpm --filter @blog-study/bot typecheck
```

Expected:

```text
No TypeScript errors.
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml packages/shared/src/config/env.ts packages/bot/package.json packages/bot/src/services/embedding.service.ts
git commit -m "feat: add embedding generation service"
```

---

### Task 5: Trigger Item Embeddings During Crawls

**Files:**

- Modify: `packages/bot/src/services/curation.service.ts`
- Modify: `packages/web/src/app/api/admin/curation/crawl/route.ts`

- [ ] **Step 1: Update bot curation service insert path**

In `packages/bot/src/services/curation.service.ts`, import:

```ts
import { getEmbeddingService } from './embedding.service';
```

After `const created = await this.addItem(...)`, call:

```ts
void getEmbeddingService()
  .refreshCurationItem(created.id)
  .catch((error) => {
    logger.warn(
      { itemId: created.id, error: serializeError(error) },
      '[CurationService] Failed to refresh curation item embedding'
    );
  });
```

- [ ] **Step 2: Update admin crawl route**

In `packages/web/src/app/api/admin/curation/crawl/route.ts`, avoid importing the bot service into web. Instead, after insert, collect inserted item IDs:

```ts
const [created] = await database
  .insert(curationItems)
  .values({
    sourceId: source.id,
    title: item.title!,
    url: item.link!,
    description,
    thumbnailUrl,
    publishedAt,
    category: source.category,
    tags: mergedTags.length > 0 ? mergedTags : null,
    relevanceScore: 0,
    isShared: false,
  })
  .returning({ id: curationItems.id });

if (created) {
  insertedItemIds.push(created.id);
}
```

Add a follow-up internal API or queue in a later task if web-triggered admin crawls must embed immediately. For first release, the backfill script plus bot crawl path is enough to avoid blocking the SSE route on external API calls.

- [ ] **Step 3: Verify typecheck**

Run:

```bash
pnpm --filter @blog-study/bot typecheck
pnpm --filter @blog-study/web typecheck
```

Expected:

```text
No TypeScript errors.
```

- [ ] **Step 4: Commit**

```bash
git add packages/bot/src/services/curation.service.ts packages/web/src/app/api/admin/curation/crawl/route.ts
git commit -m "feat: refresh curation embeddings after crawl"
```

---

### Task 6: Refresh Member Preference Embeddings

**Files:**

- Modify: `packages/web/src/app/api/profile/onboarding/route.ts`
- Modify: `packages/web/src/app/api/profile/edit/route.ts`
- Optional Create: `packages/web/src/app/api/internal/member-preference-embedding/route.ts`

- [ ] **Step 1: Add internal route for preference refresh**

Create `packages/web/src/app/api/internal/member-preference-embedding/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001';
const BOT_API_SECRET = process.env.BOT_API_SECRET;

export async function POST(request: NextRequest) {
  const expectedKey = process.env.INTERNAL_API_KEY;
  const providedKey = request.headers.get('x-api-key');

  if (!expectedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const memberId = typeof body.memberId === 'string' ? body.memberId : '';
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  if (!BOT_API_SECRET) {
    return NextResponse.json({ skipped: true, reason: 'BOT_API_SECRET missing' });
  }

  const response = await fetch(`${BOT_API_URL}/api/internal/member-preference-embedding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BOT_API_SECRET}`,
    },
    body: JSON.stringify({ memberId }),
  });

  return NextResponse.json({ ok: response.ok }, { status: response.ok ? 200 : 502 });
}
```

If adding a bot endpoint is too much for this release, skip the internal route and rely on the backfill script after profile changes. The product behavior remains correct after backfill, but not immediately personalized.

- [ ] **Step 2: Trigger refresh after profile writes**

In onboarding/edit routes, after member update succeeds:

```ts
const webUrl = process.env.WEB_URL;
const apiKey = process.env.INTERNAL_API_KEY;
if (webUrl && apiKey) {
  fetch(`${webUrl}/api/internal/member-preference-embedding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ memberId: updatedMember.id }),
  }).catch(() => undefined);
}
```

- [ ] **Step 3: Verify typecheck**

Run:

```bash
pnpm --filter @blog-study/web typecheck
```

Expected:

```text
No TypeScript errors.
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/app/api/profile/onboarding/route.ts packages/web/src/app/api/profile/edit/route.ts packages/web/src/app/api/internal/member-preference-embedding/route.ts
git commit -m "feat: refresh member recommendation profile"
```

---

### Task 7: Replace Recommended Sort Query

**Files:**

- Modify: `packages/web/src/app/api/curation/route.ts`
- Create or Modify test helper around recommendation SQL if route tests are not practical.

- [ ] **Step 1: Keep existing fallback branch**

Preserve current overlap/latest logic under this condition:

```ts
const useVectorRecommendedSort = isRecommended && Boolean(memberPreferenceEmbedding);
```

If no preference embedding exists, keep the current `userInterests.length > 0` overlap path. If no interests exist, fall back to latest.

- [ ] **Step 2: Fetch member preference embedding**

Add `memberPreferenceEmbeddings` import from shared db.

Fetch:

```ts
const [memberProfile] = await database
  .select({
    memberId: members.id,
    interests: members.interests,
    embedding: memberPreferenceEmbeddings.embedding,
  })
  .from(members)
  .leftJoin(memberPreferenceEmbeddings, eq(memberPreferenceEmbeddings.memberId, members.id))
  .where(eq(members.discordId, discordId))
  .limit(1);
```

- [ ] **Step 3: Add vector score expressions**

Use SQL expressions:

```ts
const semanticScoreExpr = sql<number>`1 - (${curationItems.embedding} <=> ${memberProfile.embedding})`;
const ageDaysExpr = sql<number>`greatest(extract(epoch from (now() - coalesce(${curationItems.publishedAt}, ${curationItems.collectedAt}, now()))) / 86400.0, 0)`;
const freshnessExpr = sql<number>`exp(-(${ageDaysExpr}) / 14.0)`;
const normalizedRelevanceExpr = sql<number>`least(greatest(coalesce(${curationItems.relevanceScore}, 0), 0), 100) / 100.0`;
const finalScoreExpr = sql<number>`((${semanticScoreExpr}) * 0.65 + (${freshnessExpr}) * 0.20 + (${normalizedRelevanceExpr}) * 0.15)`;
```

Add filter:

```ts
queryConditions.push(sql`${curationItems.embedding} is not null`);
```

- [ ] **Step 4: Add cursor condition**

For cursor `score|date|id`:

```ts
queryConditions.push(
  sql`((${finalScoreExpr}) < ${cursorScore}
    OR ((${finalScoreExpr}) = ${cursorScore} AND ${curationItems.publishedAt} < ${cursorIso}::timestamptz)
    OR ((${finalScoreExpr}) = ${cursorScore} AND ${curationItems.publishedAt} = ${cursorIso}::timestamptz AND ${curationItems.id} < ${cursorId}))`
);
```

- [ ] **Step 5: Query order**

Use:

```ts
.select({ ...BASE_SELECT, finalScore: finalScoreExpr.as('final_score') })
.from(curationItems)
.leftJoin(curationSources, eq(curationItems.sourceId, curationSources.id))
.where(whereClause)
.orderBy(sql`final_score DESC`, sql`${curationItems.publishedAt} DESC NULLS LAST`, desc(curationItems.id))
.limit(limit + 1);
```

- [ ] **Step 6: Verify API behavior manually**

Run web:

```bash
pnpm --filter @blog-study/web dev
```

Request after login:

```bash
curl 'http://localhost:3300/api/curation?sort=recommended&limit=12'
```

Expected:

```text
200 JSON response with items, nextCursor, hasMore, totalCount.
```

- [ ] **Step 7: Verify typecheck**

Run:

```bash
pnpm --filter @blog-study/web typecheck
```

Expected:

```text
No TypeScript errors.
```

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/app/api/curation/route.ts
git commit -m "feat: rank curation feed by vector similarity"
```

---

### Task 8: Add Backfill Scripts

**Files:**

- Create: `packages/bot/src/scripts/backfill-curation-embeddings.ts`
- Create: `packages/bot/src/scripts/backfill-member-preference-embeddings.ts`
- Modify: `packages/bot/package.json`

- [ ] **Step 1: Add curation backfill script**

Create `packages/bot/src/scripts/backfill-curation-embeddings.ts`:

```ts
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { getEmbeddingService } from '../services/embedding.service';

config({ path: resolve(process.cwd(), '../../.env.local') });
config({ path: resolve(process.cwd(), '../../.env') });

async function main() {
  const limit = Number(process.argv[2] ?? 50);
  const updated = await getEmbeddingService().backfillMissingCurationItems(limit);
  console.log(`Updated ${updated} curation item embeddings`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Add member backfill script**

Create `packages/bot/src/scripts/backfill-member-preference-embeddings.ts`:

```ts
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, members, MemberStatus } from '@blog-study/shared/db';
import { getEmbeddingService } from '../services/embedding.service';

config({ path: resolve(process.cwd(), '../../.env.local') });
config({ path: resolve(process.cwd(), '../../.env') });

async function main() {
  const db = getDb();
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.status, MemberStatus.ACTIVE));

  let updated = 0;
  for (const row of rows) {
    if (await getEmbeddingService().refreshMemberPreference(row.id)) updated++;
  }
  console.log(`Updated ${updated} member preference embeddings`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Add package scripts**

In `packages/bot/package.json`:

```json
"backfill-curation-embeddings": "tsx src/scripts/backfill-curation-embeddings.ts",
"backfill-member-preference-embeddings": "tsx src/scripts/backfill-member-preference-embeddings.ts"
```

- [ ] **Step 4: Run dry backfill with missing API key**

Run:

```bash
pnpm --filter @blog-study/bot backfill-curation-embeddings 5
```

Expected if the local embedding server is unavailable:

```text
Updated 0 curation item embeddings
```

Expected if the local embedding server is available:

```text
Updated N curation item embeddings
```

- [ ] **Step 5: Commit**

```bash
git add packages/bot/src/scripts/backfill-curation-embeddings.ts packages/bot/src/scripts/backfill-member-preference-embeddings.ts packages/bot/package.json
git commit -m "feat: add embedding backfill scripts"
```

---

### Task 9: Production Verification

**Files:**

- No code changes unless verification finds defects.

- [ ] **Step 1: Apply migration in staging or branch first**

Run migration against a Supabase branch or local DB first.

Verify:

```sql
select extname, extversion
from pg_extension
where extname = 'vector';
```

Expected:

```text
vector row exists
```

- [ ] **Step 2: Verify columns**

Run:

```sql
select column_name, data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('curation_items', 'member_preference_embeddings')
  and column_name in ('embedding', 'embedding_model', 'embedded_at', 'preference_text');
```

Expected:

```text
embedding columns exist; udt_name is vector for vector columns.
```

- [ ] **Step 3: Backfill**

Run:

```bash
pnpm --filter @blog-study/bot backfill-member-preference-embeddings
pnpm --filter @blog-study/bot backfill-curation-embeddings 100
```

Expected:

```text
Updated N member preference embeddings
Updated N curation item embeddings
```

- [ ] **Step 4: Verify vector ranking**

Run SQL with a real member:

```sql
select ci.id,
       ci.title,
       1 - (ci.embedding <=> mpe.embedding) as semantic_score
from public.curation_items ci
join public.member_preference_embeddings mpe on mpe.member_id = '<member-id>'::uuid
where ci.embedding is not null
order by semantic_score desc
limit 10;
```

Expected:

```text
10 rows ordered by semantic_score descending.
```

- [ ] **Step 5: Verify API**

Open:

```text
http://localhost:3300/curation?sort=recommended
```

Expected:

```text
Feed loads, infinite scroll works, category/tag/search filters still work.
```

- [ ] **Step 6: Commit verification fixes**

If fixes were needed:

```bash
git add <changed-files>
git commit -m "fix: stabilize vector curation recommendations"
```

---

## Security Follow-Up

Do not bundle RLS enablement into this feature migration. Create a separate security plan for:

- Enabling RLS on exposed public tables.
- Adding ownership policies for member-private data.
- Keeping admin/server-only write paths working through service-role or server DB connection.
- Verifying `/curation`, profile, admin, and bot jobs after RLS.

The recommendation feature increases use of `members.bio`, `members.interests`, and derived preference text, so this follow-up should happen before broad production rollout.

## Rollout Plan

1. Deploy schema migration with `vector` extension and nullable embedding columns.
2. Deploy code with fallback still active.
3. Run member and item backfills.
4. Monitor `/api/curation?sort=recommended` latency and errors.
5. Once most active users and items have embeddings, treat vector path as primary.
6. Keep fallback permanently for new users, API-key outages, and not-yet-embedded items.

## Definition of Done

- `sort=latest` behavior unchanged.
- `sort=recommended` uses vector similarity when member and item embeddings exist.
- Recommended sort falls back gracefully when embeddings are missing.
- New bot-crawled items get embeddings asynchronously.
- Profile onboarding/edit can refresh member preference embeddings, or backfill covers the delay.
- Backfill scripts can populate current data.
- HNSW indexes exist for vector search.
- Typecheck passes for shared, bot, and web packages.
- Manual API verification succeeds on `/curation?sort=recommended`.
