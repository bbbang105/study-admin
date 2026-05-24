import { eq, inArray, isNull, or } from 'drizzle-orm';
import {
  buildCurationItemEmbeddingText,
  buildMemberPreferenceText,
  buildPostEmbeddingText,
  sha256Text,
} from '@blog-study/shared';
import {
  curationItems,
  curationSources,
  getDb,
  memberPreferenceEmbeddings,
  members,
  MemberStatus,
  postEmbeddings,
  posts,
  rounds,
} from '@blog-study/shared/db';
import logger, { serializeError } from '../lib/logger';

const DEFAULT_PROVIDER = process.env.EMBEDDING_PROVIDER || 'ollama';
const DEFAULT_BASE_URL = process.env.EMBEDDING_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const DEFAULT_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || 768);

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function accessHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (process.env.EMBEDDING_ACCESS_CLIENT_ID) {
    headers['CF-Access-Client-Id'] = process.env.EMBEDDING_ACCESS_CLIENT_ID;
  }
  if (process.env.EMBEDDING_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Secret'] = process.env.EMBEDDING_ACCESS_CLIENT_SECRET;
  }
  if (process.env.EMBEDDING_API_KEY) {
    headers.Authorization = `Bearer ${process.env.EMBEDDING_API_KEY}`;
  }
  return headers;
}

export class EmbeddingService {
  private db = getDb();
  private baseUrl = normalizeBaseUrl(DEFAULT_BASE_URL);

  private async embed(text: string): Promise<number[] | null> {
    try {
      if (DEFAULT_PROVIDER === 'openai-compatible') {
        return await this.embedOpenAICompatible(text);
      }
      return await this.embedOllama(text);
    } catch (error) {
      logger.warn({ error: serializeError(error) }, '[EmbeddingService] Embedding request failed');
      return null;
    }
  }

  private async embedOllama(text: string): Promise<number[] | null> {
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: {
        ...accessHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        input: text,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as { embeddings?: number[][] };
    const embedding = data.embeddings?.[0] ?? null;
    return this.validateEmbedding(embedding);
  }

  private async embedOpenAICompatible(text: string): Promise<number[] | null> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        ...accessHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        input: text,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible embedding failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const embedding = data.data?.[0]?.embedding ?? null;
    return this.validateEmbedding(embedding);
  }

  private validateEmbedding(embedding: number[] | null): number[] | null {
    if (!embedding) return null;
    if (embedding.length !== DEFAULT_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch: expected ${DEFAULT_DIMENSIONS}, got ${embedding.length}`
      );
    }
    return embedding;
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

    const embeddingText = buildCurationItemEmbeddingText(row);
    const embeddingTextHash = sha256Text(embeddingText);
    const embedding = await this.embed(embeddingText);
    if (!embedding) return false;

    await this.db
      .update(curationItems)
      .set({
        embedding,
        embeddingTextHash,
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

  async refreshPost(postId: string): Promise<boolean> {
    const [row] = await this.db
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        authorPart: members.part,
        authorBio: members.bio,
        authorInterests: members.interests,
        authorNickname: members.nickname,
        roundNumber: rounds.roundNumber,
      })
      .from(posts)
      .leftJoin(members, eq(posts.memberId, members.id))
      .leftJoin(rounds, eq(posts.roundId, rounds.id))
      .where(eq(posts.id, postId))
      .limit(1);

    if (!row) return false;

    const embeddingText = buildPostEmbeddingText(row);
    const embeddingTextHash = sha256Text(embeddingText);
    const embedding = await this.embed(embeddingText);
    if (!embedding) return false;

    await this.db
      .insert(postEmbeddings)
      .values({
        postId,
        embedding,
        embeddingText,
        embeddingTextHash,
        embeddingModel: DEFAULT_MODEL,
        embeddedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: postEmbeddings.postId,
        set: {
          embedding,
          embeddingText,
          embeddingTextHash,
          embeddingModel: DEFAULT_MODEL,
          embeddedAt: new Date(),
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

  async backfillMissingPosts(limit = 50): Promise<number> {
    const rows = await this.db
      .select({ id: posts.id })
      .from(posts)
      .leftJoin(postEmbeddings, eq(postEmbeddings.postId, posts.id))
      .where(or(isNull(postEmbeddings.postId), isNull(postEmbeddings.embeddedAt)))
      .limit(limit);

    let updated = 0;
    for (const row of rows) {
      if (await this.refreshPost(row.id)) updated++;
    }
    return updated;
  }

  async backfillActiveMemberPreferences(): Promise<number> {
    const rows = await this.db
      .select({ id: members.id })
      .from(members)
      .where(inArray(members.status, [MemberStatus.ACTIVE, MemberStatus.OB, MemberStatus.DORMANT]));

    let updated = 0;
    for (const row of rows) {
      if (await this.refreshMemberPreference(row.id)) updated++;
    }
    return updated;
  }
}

let embeddingService: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  embeddingService ??= new EmbeddingService();
  return embeddingService;
}
