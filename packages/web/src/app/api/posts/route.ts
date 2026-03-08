import { NextRequest } from 'next/server';
import { count, desc, eq } from 'drizzle-orm';
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

const { posts, members, rounds } = sharedDb;

/**
 * GET /api/posts
 * Get paginated list of all posts
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

    const database = db();

    // Get total count
    const totalCountResult = await database.select({ count: count() }).from(posts);
    const totalCount = totalCountResult[0]?.count ?? 0;

    // Get paginated posts with member and round info
    const postsResult = await database
      .select({
        id: posts.id,
        title: posts.title,
        url: posts.url,
        publishedAt: posts.publishedAt,
        memberNickname: members.nickname,
        memberDiscordUsername: members.discordUsername,
        memberPart: members.part,
        roundNumber: rounds.roundNumber,
      })
      .from(posts)
      .leftJoin(members, eq(posts.memberId, members.id))
      .leftJoin(rounds, eq(posts.roundId, rounds.id))
      .orderBy(desc(posts.publishedAt))
      .limit(pageSize)
      .offset(offset);

    return successResponse({
      posts: postsResult.map((post) => ({
        id: post.id,
        title: post.title,
        url: post.url,
        publishedAt: post.publishedAt?.toISOString(),
        memberNickname: post.memberNickname,
        memberDiscordUsername: post.memberDiscordUsername,
        memberPart: post.memberPart,
        roundNumber: post.roundNumber,
      })),
      pagination: createPaginationMeta(page, pageSize, totalCount),
    });
  } catch (error) {
    console.error('Posts API error:', error);
    return errorResponse(error);
  }
}
