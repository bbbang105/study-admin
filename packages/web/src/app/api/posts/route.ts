import { NextRequest } from 'next/server';
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { buildPostRecommendationReason } from '@blog-study/shared';
import {
  createPaginationMeta,
  errorResponse,
  Errors,
  parsePagination,
  successResponse,
} from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';
import { isAdminDiscordId } from '@/lib/admin';

const {
  posts,
  members,
  rounds,
  postViews,
  postReactions,
  postEmbeddings,
  memberPreferenceEmbeddings,
} = sharedDb;

/**
 * GET /api/posts
 * Get paginated list of all posts with author profile, viewer info, and comment count
 * Requirement: 18.2
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

    // 현재 유저의 discordId → memberId 조회
    const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
    const currentDiscordId = discordIdentity?.id as string | undefined;

    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const sort = searchParams.get('sort') || 'latest'; // latest | popular | recommended
    const roundId = searchParams.get('roundId'); // 회차별 필터

    const database = db();

    // 현재 유저의 memberId + 관리자 여부 + 추천 프로필 조회
    let currentMemberId: string | null = null;
    let currentMemberPart: string | null = null;
    let currentMemberInterests: string[] = [];
    let hasPreferenceEmbedding = false;
    let isAdmin = false;
    if (currentDiscordId) {
      const [currentMember] = await database
        .select({
          id: members.id,
          part: members.part,
          interests: members.interests,
          preferenceMemberId: memberPreferenceEmbeddings.memberId,
        })
        .from(members)
        .leftJoin(memberPreferenceEmbeddings, eq(memberPreferenceEmbeddings.memberId, members.id))
        .where(eq(members.discordId, currentDiscordId))
        .limit(1);
      currentMemberId = currentMember?.id ?? null;
      currentMemberPart = currentMember?.part ?? null;
      currentMemberInterests = currentMember?.interests ?? [];
      hasPreferenceEmbedding = Boolean(currentMember?.preferenceMemberId);
      isAdmin = await isAdminDiscordId(currentDiscordId);
    }

    // 검색어 (LIKE 메타문자 이스케이프)
    const rawSearch = searchParams.get('search')?.trim() || null;
    const search = rawSearch ? rawSearch.replace(/[%_\\]/g, '\\$&') : null;
    // 파트 필터 (쉼표 구분, 복수 선택, allowlist 검증)
    const VALID_PARTS = [
      'frontend',
      'backend',
      'fullstack',
      'designer',
      'planner',
      'devops',
      'llmops',
      'other',
    ];
    const partsParam = searchParams.get('parts')?.trim() || null;
    const partsFilter = partsParam
      ? partsParam.split(',').filter((p) => VALID_PARTS.includes(p))
      : null;

    // 회차별 필터 조건
    const roundIdNum = roundId ? parseInt(roundId, 10) : null;
    if (roundIdNum !== null && isNaN(roundIdNum)) {
      return Errors.badRequest('유효하지 않은 회차 ID입니다.').toResponse();
    }

    // WHERE 조건 조합 (soft deleted 제외)
    const conditions = [isNull(posts.deletedAt)];
    if (roundIdNum !== null) conditions.push(eq(posts.roundId, roundIdNum));
    if (sort === 'recommended' && currentMemberId) {
      conditions.push(sql`${posts.memberId} <> ${currentMemberId}`);
    }
    if (search) {
      const searchCondition = or(
        ilike(posts.title, `%${search}%`),
        ilike(members.name, `%${search}%`),
        ilike(members.nickname, `%${search}%`),
        ilike(members.discordUsername, `%${search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    if (partsFilter && partsFilter.length > 0) {
      conditions.push(inArray(members.part, partsFilter));
    }
    const whereCondition = and(...conditions);

    // Get total count (join members for search/parts filter)
    const totalCountQuery = database
      .select({ count: count() })
      .from(posts)
      .leftJoin(members, eq(posts.memberId, members.id))
      .where(whereCondition);
    const totalCountResult = await totalCountQuery;
    const totalCount = totalCountResult[0]?.count ?? 0;

    // 정렬 기준: 인기순은 score desc → 동점 시 댓글 많은 순 → 최신순
    // 가중치: 댓글 3, 조회수 2, 리액션 1
    const popularScore = sql<number>`COALESCE(${posts.commentCount}, 0) * 3 + (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = ${posts.id}) * 2 + (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = ${posts.id})`;

    const useRecommendedSort =
      sort === 'recommended' && Boolean(currentMemberId && hasPreferenceEmbedding);
    let semanticScoreExpr: ReturnType<typeof sql<number>> | null = null;
    let freshnessScoreExpr: ReturnType<typeof sql<number>> | null = null;
    let popularityScoreExpr: ReturnType<typeof sql<number>> | null = null;
    let authorAffinityScoreExpr: ReturnType<typeof sql<number>> | null = null;
    let finalScoreExpr: ReturnType<typeof sql<number>> | null = null;

    if (useRecommendedSort && currentMemberId) {
      semanticScoreExpr = sql<number>`1 - (${postEmbeddings.embedding} <=> ${memberPreferenceEmbeddings.embedding})`;
      const ageDaysExpr = sql<number>`greatest(extract(epoch from (now() - coalesce(${posts.publishedAt}, ${posts.collectedAt}, now()))) / 86400.0, 0)`;
      freshnessScoreExpr = sql<number>`exp(-(${ageDaysExpr}) / 14.0)`;
      popularityScoreExpr = sql<number>`least(greatest((${popularScore}) / 20.0, 0), 1)`;
      const interestsArray = sql`ARRAY[${sql.join(
        currentMemberInterests.map((interest) => sql`${interest}`),
        sql`,`
      )}]::text[]`;
      authorAffinityScoreExpr = sql<number>`case
        when ${members.part} = ${currentMemberPart} then 1.0
        when coalesce(array_length(ARRAY(SELECT unnest(coalesce(${members.interests}, ARRAY[]::text[])) INTERSECT SELECT unnest(${interestsArray})), 1), 0) > 0 then 0.5
        else 0.0
      end`;
      finalScoreExpr = sql<number>`((${semanticScoreExpr}) * 0.70 + (${freshnessScoreExpr}) * 0.15 + (${popularityScoreExpr}) * 0.10 + (${authorAffinityScoreExpr}) * 0.05)`;
    }

    // Get paginated posts with member and round info
    const queryConditions = [...conditions];
    if (useRecommendedSort) {
      queryConditions.push(sql`${postEmbeddings.postId} IS NOT NULL`);
    }
    const postsWhereCondition = and(...queryConditions);

    const postsQuery = database
      .select({
        id: posts.id,
        title: posts.title,
        url: posts.url,
        publishedAt: posts.publishedAt,
        description: posts.description,
        thumbnailUrl: posts.thumbnailUrl,
        commentCount: posts.commentCount,
        memberId: members.id,
        memberNickname: members.nickname,
        memberDiscordUsername: members.discordUsername,
        memberProfileImageUrl: members.profileImageUrl,
        memberPart: members.part,
        memberInterests: members.interests,
        roundNumber: rounds.roundNumber,
        roundId: posts.roundId,
        semanticScore: semanticScoreExpr ? semanticScoreExpr.as('semantic_score') : sql<null>`NULL`,
        freshnessScore: freshnessScoreExpr
          ? freshnessScoreExpr.as('freshness_score')
          : sql<null>`NULL`,
        popularityScore: popularityScoreExpr
          ? popularityScoreExpr.as('popularity_score')
          : sql<null>`NULL`,
        authorAffinityScore: authorAffinityScoreExpr
          ? authorAffinityScoreExpr.as('author_affinity_score')
          : sql<null>`NULL`,
        finalScore: finalScoreExpr ? finalScoreExpr.as('final_score') : sql<null>`NULL`,
      })
      .from(posts)
      .leftJoin(members, eq(posts.memberId, members.id))
      .leftJoin(rounds, eq(posts.roundId, rounds.id))
      .leftJoin(postEmbeddings, eq(postEmbeddings.postId, posts.id))
      .leftJoin(
        memberPreferenceEmbeddings,
        eq(
          memberPreferenceEmbeddings.memberId,
          currentMemberId ?? '00000000-0000-0000-0000-000000000000'
        )
      )
      .where(postsWhereCondition)
      .orderBy(
        ...(useRecommendedSort && finalScoreExpr
          ? [sql`semantic_score DESC`, sql`final_score DESC`, desc(posts.publishedAt)]
          : sort === 'popular'
            ? [desc(popularScore), desc(posts.commentCount), desc(posts.publishedAt)]
            : [desc(posts.publishedAt)])
      )
      .limit(pageSize)
      .offset(offset);

    const postsResult = await postsQuery;

    // Get viewer info for these posts (max 4 per post for display)
    const postIds = postsResult.map((p) => p.id);
    const viewersMap = new Map<
      string,
      {
        memberId: string;
        nickname: string | null;
        discordUsername: string;
        profileImageUrl: string | null;
      }[]
    >();
    let viewCountMap = new Map<string, number>();
    let reactionCountMap = new Map<string, number>();

    if (postIds.length > 0) {
      // Get view counts per post
      const viewCounts = await database
        .select({
          postId: postViews.postId,
          count: count(),
        })
        .from(postViews)
        .where(inArray(postViews.postId, postIds))
        .groupBy(postViews.postId);

      viewCountMap = new Map(viewCounts.map((v) => [v.postId, v.count]));

      // Get reaction counts per post
      const reactionCounts = await database
        .select({
          postId: postReactions.postId,
          count: count(),
        })
        .from(postReactions)
        .where(inArray(postReactions.postId, postIds))
        .groupBy(postReactions.postId);

      reactionCountMap = new Map(reactionCounts.map((r) => [r.postId, r.count]));

      // Get recent viewers per post with member info (Drizzle query)
      const allViewers = await database
        .select({
          postId: postViews.postId,
          memberId: members.id,
          nickname: members.nickname,
          discordUsername: members.discordUsername,
          profileImageUrl: members.profileImageUrl,
          viewedAt: postViews.viewedAt,
        })
        .from(postViews)
        .innerJoin(members, eq(postViews.memberId, members.id))
        .where(inArray(postViews.postId, postIds))
        .orderBy(desc(postViews.viewedAt));

      // Group by postId and keep max 4 per post
      for (const row of allViewers) {
        if (!viewersMap.has(row.postId)) viewersMap.set(row.postId, []);
        const list = viewersMap.get(row.postId)!;
        if (list.length < 4) {
          list.push({
            memberId: row.memberId,
            nickname: row.nickname,
            discordUsername: row.discordUsername,
            profileImageUrl: row.profileImageUrl,
          });
        }
      }
    }

    return successResponse({
      posts: postsResult.map((post) => ({
        id: post.id,
        title: post.title,
        url: post.url,
        publishedAt: post.publishedAt?.toISOString(),
        description: post.description,
        thumbnailUrl: post.thumbnailUrl,
        commentCount: post.commentCount ?? 0,
        memberId: post.memberId,
        memberNickname: post.memberNickname,
        memberDiscordUsername: post.memberDiscordUsername,
        memberProfileImageUrl: post.memberProfileImageUrl,
        memberPart: post.memberPart,
        roundId: post.roundId,
        roundNumber: post.roundNumber,
        viewCount: viewCountMap.get(post.id) ?? 0,
        viewers: (viewersMap.get(post.id) ?? []).slice(0, 3),
        totalViewers: viewCountMap.get(post.id) ?? 0,
        reactionCount: reactionCountMap.get(post.id) ?? 0,
        recommendationReason: buildPostRecommendationReason({
          interests: currentMemberInterests,
          title: post.title,
          description: post.description,
          authorPart: post.memberPart,
          currentMemberPart,
          publishedAt: post.publishedAt,
          semanticScore: post.semanticScore,
          freshnessScore: post.freshnessScore,
          popularityScore: post.popularityScore,
          authorAffinityScore: post.authorAffinityScore,
        }),
      })),
      currentMemberId,
      isAdmin,
      pagination: createPaginationMeta(page, pageSize, totalCount),
    });
  } catch (error) {
    console.error('Posts API error:', error);
    return errorResponse(error);
  }
}
