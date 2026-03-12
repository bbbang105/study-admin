import { NextRequest } from 'next/server';
import { count, desc, eq, inArray, sql } from 'drizzle-orm';
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

const { posts, members, rounds, postViews } = sharedDb;

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

    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const sort = searchParams.get('sort') || 'latest'; // latest | popular
    const roundId = searchParams.get('roundId'); // 회차별 필터

    const database = db();

    // 회차별 필터 조건
    const roundIdNum = roundId ? parseInt(roundId, 10) : null;
    if (roundIdNum !== null && isNaN(roundIdNum)) {
      return Errors.badRequest('유효하지 않은 회차 ID입니다.').toResponse();
    }
    const whereCondition = roundIdNum ? eq(posts.roundId, roundIdNum) : undefined;

    // Get total count
    const totalCountQuery = database.select({ count: count() }).from(posts);
    if (whereCondition) totalCountQuery.where(whereCondition);
    const totalCountResult = await totalCountQuery;
    const totalCount = totalCountResult[0]?.count ?? 0;

    // 정렬 기준: 인기순은 score desc → 동점 시 댓글 많은 순 → 최신순
    const popularScore = sql`COALESCE(${posts.commentCount}, 0) * 3 + (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = ${posts.id})`;

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
      .orderBy(...(sort === 'popular'
        ? [desc(popularScore), desc(posts.commentCount), desc(posts.publishedAt)]
        : [desc(posts.publishedAt)]))
      .limit(pageSize)
      .offset(offset);

    if (whereCondition) postsQuery.where(whereCondition);
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
      })),
      pagination: createPaginationMeta(page, pageSize, totalCount),
    });
  } catch (error) {
    console.error('Posts API error:', error);
    return errorResponse(error);
  }
}
