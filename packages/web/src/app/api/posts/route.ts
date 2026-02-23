import { NextRequest } from 'next/server';
import { desc, count, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { 
  successResponse, 
  errorResponse, 
  parsePagination, 
  createPaginationMeta 
} from '@/lib/api-error';

const { posts, members, rounds } = sharedDb;

/**
 * GET /api/posts
 * Get paginated list of all posts
 * Requirement: 18.2
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const database = db();

    // Get total count
    const totalCountResult = await database
      .select({ count: count() })
      .from(posts);
    const totalCount = totalCountResult[0]?.count ?? 0;

    // Get paginated posts with member and round info
    const postsResult = await database
      .select({
        id: posts.id,
        title: posts.title,
        url: posts.url,
        publishedAt: posts.publishedAt,
        memberName: members.name,
        memberDiscordUsername: members.discordUsername,
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
        memberName: post.memberName,
        memberDiscordUsername: post.memberDiscordUsername,
        roundNumber: post.roundNumber,
      })),
      pagination: createPaginationMeta(page, pageSize, totalCount),
    });
  } catch (error) {
    console.error('Posts API error:', error);
    return errorResponse(error);
  }
}
