import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { boardPosts, members } = sharedDb;

export async function GET() {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const database = getDb();

    const [banner] = await database
      .select({
        id: boardPosts.id,
        title: boardPosts.title,
        contentText: boardPosts.contentText,
        createdAt: boardPosts.createdAt,
        memberName: members.nickname,
      })
      .from(boardPosts)
      .innerJoin(members, eq(boardPosts.memberId, members.id))
      .where(
        and(
          eq(boardPosts.isNoticeBanner, true),
          eq(boardPosts.isPinned, true),
          isNull(boardPosts.deletedAt)
        )
      )
      .limit(1);

    const response = successResponse(banner || null);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
