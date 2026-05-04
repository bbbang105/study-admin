import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const { REACTION_EMOJIS } = sharedDb;
type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

const { postReactions, posts, members } = sharedDb;

/**
 * GET /api/posts/[id]/reactions
 * 포스트 리액션 조회
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const database = getDb();

    const reactionsRaw = await database
      .select({
        emoji: postReactions.emoji,
        memberId: postReactions.memberId,
        memberName: members.nickname,
      })
      .from(postReactions)
      .innerJoin(members, eq(postReactions.memberId, members.id))
      .where(eq(postReactions.postId, postId));

    const reactions: Record<
      string,
      { count: number; members: { id: string; nickname: string }[]; reacted: boolean }
    > = {};
    for (const row of reactionsRaw) {
      if (!reactions[row.emoji]) {
        reactions[row.emoji] = { count: 0, members: [], reacted: false };
      }
      const r = reactions[row.emoji]!;
      r.count++;
      r.members.push({ id: row.memberId, nickname: row.memberName ?? '' });
      if (row.memberId === auth.memberId) {
        r.reacted = true;
      }
    }

    return successResponse({ reactions });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/posts/[id]/reactions
 * 포스트 리액션 토글
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const body = await request.json();
    const { emoji } = body as { emoji: string };

    if (!emoji || !REACTION_EMOJIS.includes(emoji as ReactionEmoji)) {
      return Errors.badRequest('유효하지 않은 이모지입니다.').toResponse();
    }

    const database = getDb();

    const [post] = await database
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .limit(1);

    if (!post) return Errors.notFound('포스트를 찾을 수 없습니다.').toResponse();

    const action = await database.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: postReactions.id })
        .from(postReactions)
        .where(
          and(
            eq(postReactions.postId, postId),
            eq(postReactions.memberId, auth.memberId),
            eq(postReactions.emoji, emoji)
          )
        )
        .limit(1);

      if (existing) {
        await tx.delete(postReactions).where(eq(postReactions.id, existing.id));
        return 'removed' as const;
      } else {
        await tx.insert(postReactions).values({ postId, memberId: auth.memberId, emoji });
        return 'added' as const;
      }
    });

    return successResponse({ action, emoji }, undefined, action === 'added' ? 201 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}
