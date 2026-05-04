import { NextRequest } from 'next/server';
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import {
  createPaginationMeta,
  errorResponse,
  Errors,
  parsePagination,
  successResponse,
} from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';
import { isAdminDiscordId } from '@/lib/admin';

const { posts, members, rounds, postViews, postReactions } = sharedDb;

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
    const sort = searchParams.get('sort') || 'latest'; // latest | popular
    const roundId = searchParams.get('roundId'); // 회차별 필터

    const database = db();

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
    const popularScore = sql`COALESCE(${posts.commentCount}, 0) * 3 + (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = ${posts.id}) * 2 + (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = ${posts.id})`;

    // Get paginated posts with member and round info
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
        roundNumber: rounds.roundNumber,
        roundId: posts.roundId,
      })
      .from(posts)
      .leftJoin(members, eq(posts.memberId, members.id))
      .leftJoin(rounds, eq(posts.roundId, rounds.id))
      .where(whereCondition)
      .orderBy(
        ...(sort === 'popular'
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

    // 현재 유저의 memberId + 관리자 여부 조회
    let currentMemberId: string | null = null;
    let isAdmin = false;
    if (currentDiscordId) {
      const [currentMember] = await database
        .select({ id: members.id })
        .from(members)
        .where(eq(members.discordId, currentDiscordId))
        .limit(1);
      currentMemberId = currentMember?.id ?? null;
      isAdmin = await isAdminDiscordId(currentDiscordId);
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
