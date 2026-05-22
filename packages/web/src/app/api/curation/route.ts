import { NextRequest } from 'next/server';
import { desc, count, eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { buildRecommendationReason, type RecommendationReason } from '@blog-study/shared';
import { successResponse, errorResponse, Errors } from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';

const { curationItems, curationSources, members, memberPreferenceEmbeddings } = sharedDb;

// ── Helpers ──

const VALID_CATEGORIES = new Set(['all', 'conference', 'article']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TAGS = 20;
const MAX_SEARCH_LENGTH = 100;

function escapeIlike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

const BASE_SELECT = {
  id: curationItems.id,
  title: curationItems.title,
  url: curationItems.url,
  description: curationItems.description,
  thumbnailUrl: curationItems.thumbnailUrl,
  publishedAt: curationItems.publishedAt,
  category: curationItems.category,
  tags: curationItems.tags,
  relevanceScore: curationItems.relevanceScore,
  isShared: curationItems.isShared,
  sharedAt: curationItems.sharedAt,
  sourceName: curationSources.name,
};

function serializeItem(item: {
  id: string;
  title: string;
  url: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  category: string;
  tags: string[] | null;
  relevanceScore: number | null;
  isShared: boolean | null;
  sharedAt: Date | null;
  sourceName: string | null;
  recommendationReason?: RecommendationReason | null;
}) {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    description: item.description ?? null,
    thumbnailUrl: item.thumbnailUrl ?? null,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    category: item.category,
    tags: item.tags,
    relevanceScore: item.relevanceScore,
    sharedAt: item.isShared ? (item.sharedAt?.toISOString() ?? null) : null,
    sourceName: item.sourceName ?? null,
    recommendationReason: item.recommendationReason ?? null,
  };
}

/**
 * GET /api/curation
 * Cursor-based pagination for infinite scroll
 * Supports category filter, tag AND-filter, search, and recommended sort
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Errors.unauthorized().toResponse();
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const tagsParam = searchParams.get('tags') || '';
    const cursor = searchParams.get('cursor');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
    const sortMode = searchParams.get('sort') || 'latest';
    const searchQuery = (searchParams.get('search')?.trim() || '').slice(0, MAX_SEARCH_LENGTH);

    // ── Input validation ──
    if (!VALID_CATEGORIES.has(category)) {
      return Errors.badRequest('유효하지 않은 카테고리입니다.').toResponse();
    }

    const database = db();

    // Build filter conditions (without cursor)
    const filterConditions = [];
    if (category !== 'all') {
      filterConditions.push(eq(curationItems.category, category));
    }

    const selectedTags = tagsParam
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_TAGS);

    if (selectedTags.length > 0) {
      filterConditions.push(
        sql`${curationItems.tags} @> ARRAY[${sql.join(
          selectedTags.map((t) => sql`${t}`),
          sql`,`
        )}]::text[]`
      );
    }

    // Search filter — escape ILIKE wildcards
    if (searchQuery) {
      const escaped = escapeIlike(searchQuery);
      filterConditions.push(
        sql`(${curationItems.title} ILIKE ${'%' + escaped + '%'} ESCAPE '\\' OR ${curationItems.description} ILIKE ${'%' + escaped + '%'} ESCAPE '\\')`
      );
    }

    // ── Recommended sort: get user interests ──
    let userInterests: string[] = [];
    let memberId: string | null = null;
    let hasPreferenceEmbedding = false;
    const isRecommended = sortMode === 'recommended';
    if (isRecommended) {
      const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
      const discordId = discordIdentity?.id;
      if (discordId) {
        const [member] = await database
          .select({
            id: members.id,
            interests: members.interests,
            preferenceMemberId: memberPreferenceEmbeddings.memberId,
          })
          .from(members)
          .leftJoin(memberPreferenceEmbeddings, eq(memberPreferenceEmbeddings.memberId, members.id))
          .where(eq(members.discordId, discordId))
          .limit(1);
        userInterests = member?.interests ?? [];
        memberId = member?.id ?? null;
        hasPreferenceEmbedding = Boolean(member?.preferenceMemberId);
      }
    }

    const useVectorRecommendedSort = isRecommended && Boolean(memberId && hasPreferenceEmbedding);
    const useOverlapRecommendedSort =
      isRecommended && !useVectorRecommendedSort && userInterests.length > 0;

    // Total count — skip on paginated requests (client already has it)
    const countWhere = filterConditions.length > 0 ? and(...filterConditions) : undefined;
    let totalCount = 0;
    if (!cursor) {
      const totalCountResult = await database
        .select({ count: count() })
        .from(curationItems)
        .where(countWhere);
      totalCount = totalCountResult[0]?.count ?? 0;
    }

    // ── Recommended sort with vector scoring ──
    if (useVectorRecommendedSort && memberId) {
      let rankingAsOfIso = new Date().toISOString();
      let cursorScore: number | null = null;
      let cursorDateStr = '';
      let cursorId = '';

      if (cursor) {
        const parts = cursor.split('|');
        if (parts.length !== 3 && parts.length !== 4) {
          return Errors.badRequest('유효하지 않은 cursor 형식입니다.').toResponse();
        }

        cursorScore = parseFloat(parts[0]!);
        cursorDateStr = parts[1]!;
        cursorId = parts[2]!;

        if (!Number.isFinite(cursorScore)) {
          return Errors.badRequest('유효하지 않은 cursor 형식입니다.').toResponse();
        }
        if (cursorId && !UUID_RE.test(cursorId)) {
          return Errors.badRequest('유효하지 않은 cursor 형식입니다.').toResponse();
        }
        if (parts[3]) {
          const parsedAsOf = new Date(parts[3]);
          if (isNaN(parsedAsOf.getTime())) {
            return Errors.badRequest('유효하지 않은 cursor 형식입니다.').toResponse();
          }
          rankingAsOfIso = parsedAsOf.toISOString();
        }
      }

      const semanticScoreExpr = sql<number>`coalesce(1 - (${curationItems.embedding} <=> ${memberPreferenceEmbeddings.embedding}), 0)`;
      const ageDaysExpr = sql<number>`greatest(extract(epoch from (${rankingAsOfIso}::timestamptz - coalesce(${curationItems.publishedAt}, ${curationItems.collectedAt}, ${rankingAsOfIso}::timestamptz))) / 86400.0, 0)`;
      const freshnessScoreExpr = sql<number>`exp(-(${ageDaysExpr}) / 14.0)`;
      const normalizedRelevanceExpr = sql<number>`least(greatest(coalesce(${curationItems.relevanceScore}, 0), 0), 100) / 100.0`;
      const finalScoreExpr = sql<number>`((${semanticScoreExpr}) * 0.65 + (${freshnessScoreExpr}) * 0.20 + (${normalizedRelevanceExpr}) * 0.15)`;

      const queryConditions = [...filterConditions];
      if (cursorScore !== null) {
        const cursorDate = cursorDateStr ? new Date(cursorDateStr) : null;
        if (cursorDate && !isNaN(cursorDate.getTime()) && cursorId) {
          const cursorIso = cursorDate.toISOString();
          queryConditions.push(
            sql`((${finalScoreExpr}) < ${cursorScore} OR ((${finalScoreExpr}) = ${cursorScore} AND ${curationItems.publishedAt} < ${cursorIso}::timestamptz) OR ((${finalScoreExpr}) = ${cursorScore} AND ${curationItems.publishedAt} = ${cursorIso}::timestamptz AND ${curationItems.id} < ${cursorId}))`
          );
        } else if (cursorId) {
          queryConditions.push(
            sql`((${finalScoreExpr}) < ${cursorScore} OR ((${finalScoreExpr}) = ${cursorScore} AND ${curationItems.publishedAt} IS NULL AND ${curationItems.id} < ${cursorId}))`
          );
        }
      }

      const whereClause = queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const itemsResult = await database
        .select({
          ...BASE_SELECT,
          finalScore: finalScoreExpr.as('final_score'),
          semanticScore: semanticScoreExpr.as('semantic_score'),
          freshnessScore: freshnessScoreExpr.as('freshness_score'),
          normalizedRelevanceScore: normalizedRelevanceExpr.as('normalized_relevance_score'),
        })
        .from(curationItems)
        .leftJoin(curationSources, eq(curationItems.sourceId, curationSources.id))
        .leftJoin(memberPreferenceEmbeddings, eq(memberPreferenceEmbeddings.memberId, memberId))
        .where(whereClause)
        .orderBy(
          sql`final_score DESC`,
          sql`${curationItems.publishedAt} DESC NULLS LAST`,
          desc(curationItems.id)
        )
        .limit(limit + 1);

      const hasMore = itemsResult.length > limit;
      const items = hasMore ? itemsResult.slice(0, limit) : itemsResult;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? `${lastItem.finalScore}|${lastItem.publishedAt?.toISOString() ?? ''}|${lastItem.id}|${rankingAsOfIso}`
          : null;

      return successResponse({
        items: items.map((item) =>
          serializeItem({
            ...item,
            recommendationReason: buildRecommendationReason({
              interests: userInterests,
              tags: item.tags,
              title: item.title,
              description: item.description,
              sourceName: item.sourceName,
              publishedAt: item.publishedAt,
              semanticScore: item.semanticScore,
              freshnessScore: item.freshnessScore,
              relevanceScore: item.relevanceScore,
            }),
          })
        ),
        nextCursor,
        hasMore,
        totalCount,
      });
    }

    // ── Recommended sort with overlap scoring fallback ──
    if (useOverlapRecommendedSort) {
      const interestsArray = sql`ARRAY[${sql.join(
        userInterests.map((i) => sql`${i}`),
        sql`,`
      )}]::text[]`;
      const overlapExpr = sql`COALESCE(array_length(ARRAY(SELECT unnest(${curationItems.tags}) INTERSECT SELECT unnest(${interestsArray})), 1), 0)`;

      const queryConditions = [...filterConditions];
      if (cursor) {
        const parts = cursor.split('|');
        if (parts.length === 3) {
          const cursorOverlap = parseInt(parts[0]!, 10);
          const cursorDateStr = parts[1]!;
          const cursorId = parts[2]!;

          if (isNaN(cursorOverlap) || cursorOverlap < 0) {
            return Errors.badRequest('유효하지 않은 cursor 형식입니다.').toResponse();
          }
          if (cursorId && !UUID_RE.test(cursorId)) {
            return Errors.badRequest('유효하지 않은 cursor 형식입니다.').toResponse();
          }

          const cursorDate = cursorDateStr ? new Date(cursorDateStr) : null;

          if (cursorDate && !isNaN(cursorDate.getTime()) && cursorId) {
            const cursorIso = cursorDate.toISOString();
            queryConditions.push(
              sql`(${overlapExpr} < ${cursorOverlap} OR (${overlapExpr} = ${cursorOverlap} AND ${curationItems.publishedAt} < ${cursorIso}::timestamptz) OR (${overlapExpr} = ${cursorOverlap} AND ${curationItems.publishedAt} = ${cursorIso}::timestamptz AND ${curationItems.id} < ${cursorId}))`
            );
          } else if (cursorId) {
            queryConditions.push(
              sql`(${overlapExpr} < ${cursorOverlap} OR (${overlapExpr} = ${cursorOverlap} AND ${curationItems.publishedAt} IS NULL AND ${curationItems.id} < ${cursorId}))`
            );
          }
        }
      }

      const whereClause = queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const itemsResult = await database
        .select({ ...BASE_SELECT, overlapCount: overlapExpr.as('overlap_count') })
        .from(curationItems)
        .leftJoin(curationSources, eq(curationItems.sourceId, curationSources.id))
        .where(whereClause)
        .orderBy(
          sql`overlap_count DESC`,
          sql`${curationItems.publishedAt} DESC NULLS LAST`,
          desc(curationItems.id)
        )
        .limit(limit + 1);

      const hasMore = itemsResult.length > limit;
      const items = hasMore ? itemsResult.slice(0, limit) : itemsResult;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? `${lastItem.overlapCount}|${lastItem.publishedAt?.toISOString() ?? ''}|${lastItem.id}`
          : null;

      return successResponse({
        items: items.map((item) =>
          serializeItem({
            ...item,
            recommendationReason: buildRecommendationReason({
              interests: userInterests,
              tags: item.tags,
              title: item.title,
              description: item.description,
              sourceName: item.sourceName,
              publishedAt: item.publishedAt,
              semanticScore: null,
              relevanceScore: item.relevanceScore,
            }),
          })
        ),
        nextCursor,
        hasMore,
        totalCount,
      });
    }

    // ── Default (latest) sort ──
    const queryConditions = [...filterConditions];
    if (cursor) {
      const separatorIdx = cursor.lastIndexOf('|');
      const cursorDateStr = separatorIdx > 0 ? cursor.slice(0, separatorIdx) : '';
      const cursorId = separatorIdx > 0 ? cursor.slice(separatorIdx + 1) : '';

      if (cursorId && !UUID_RE.test(cursorId)) {
        return Errors.badRequest('유효하지 않은 cursor 형식입니다.').toResponse();
      }

      const cursorDate = cursorDateStr ? new Date(cursorDateStr) : null;
      if (cursorDate && !isNaN(cursorDate.getTime()) && cursorId) {
        const cursorIso = cursorDate.toISOString();
        queryConditions.push(
          sql`(${curationItems.publishedAt} < ${cursorIso}::timestamptz OR (${curationItems.publishedAt} = ${cursorIso}::timestamptz AND ${curationItems.id} < ${cursorId}))`
        );
      } else if (cursorId && !cursorDateStr) {
        queryConditions.push(
          sql`(${curationItems.publishedAt} IS NULL AND ${curationItems.id} < ${cursorId})`
        );
      } else if (cursorDate && !isNaN(cursorDate.getTime())) {
        queryConditions.push(
          sql`${curationItems.publishedAt} < ${cursorDate.toISOString()}::timestamptz`
        );
      }
    }
    const whereClause = queryConditions.length > 0 ? and(...queryConditions) : undefined;

    const itemsResult = await database
      .select(BASE_SELECT)
      .from(curationItems)
      .leftJoin(curationSources, eq(curationItems.sourceId, curationSources.id))
      .where(whereClause)
      .orderBy(sql`${curationItems.publishedAt} DESC NULLS LAST`, desc(curationItems.id))
      .limit(limit + 1);

    const hasMore = itemsResult.length > limit;
    const items = hasMore ? itemsResult.slice(0, limit) : itemsResult;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? `${lastItem.publishedAt?.toISOString() ?? ''}|${lastItem.id}` : null;

    return successResponse({
      items: items.map(serializeItem),
      nextCursor,
      hasMore,
      totalCount,
    });
  } catch (error) {
    console.error('Curation API error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse(error);
  }
}
