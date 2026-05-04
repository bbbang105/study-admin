import { and, eq, isNull, like } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { isAdminDiscordId } from '@/lib/admin';

const { posts, members, postComments, postViews, postReactions, activityScores, ActivityScoreType } = sharedDb;

/**
 * PATCH /api/posts/[id]
 * 포스트 수정 (제목 + 설명, 본인 또는 관리자만)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: postId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Errors.unauthorized().toResponse();
    }

    const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
    const discordId = discordIdentity?.id as string | undefined;
    if (!discordId) {
      return Errors.unauthorized('Discord 계정 정보를 찾을 수 없습니다.').toResponse();
    }

    const database = db();

    // 포스트 조회 (soft deleted 제외)
    const [post] = await database
      .select({ id: posts.id, memberId: posts.memberId })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .limit(1);

    if (!post) {
      return Errors.notFound('포스트를 찾을 수 없습니다.').toResponse();
    }

    // 권한 체크: 본인 또는 관리자
    const [member] = await database
      .select({ id: members.id, discordId: members.discordId })
      .from(members)
      .where(eq(members.id, post.memberId))
      .limit(1);

    const isOwner = member?.discordId === discordId;
    const isAdmin = await isAdminDiscordId(discordId);

    if (!isOwner && !isAdmin) {
      return Errors.forbidden('수정 권한이 없습니다.').toResponse();
    }

    const body = await request.json();
    const { title, description } = body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined && typeof title === 'string' && title.trim()) {
      updates.title = title.trim().slice(0, 2000);
    }
    if (description !== undefined) {
      updates.description =
        typeof description === 'string' ? description.trim().slice(0, 300) : null;
    }

    if (Object.keys(updates).length === 0) {
      return Errors.badRequest('수정할 내용이 없습니다.').toResponse();
    }

    const [updated] = await database
      .update(posts)
      .set(updates)
      .where(eq(posts.id, postId))
      .returning();

    return successResponse({ post: updated });
  } catch (error) {
    console.error('Post update error:', error);
    return errorResponse(error);
  }
}

/**
 * DELETE /api/posts/[id]
 * 포스트 삭제 (본인 또는 관리자만)
 * - 관련 댓글, 조회 기록, 활동 점수(blog_post) 함께 삭제
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: postId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Errors.unauthorized().toResponse();
    }

    const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
    const discordId = discordIdentity?.id as string | undefined;
    if (!discordId) {
      return Errors.unauthorized('Discord 계정 정보를 찾을 수 없습니다.').toResponse();
    }

    const database = db();

    // 포스트 조회 (soft deleted 제외)
    const [post] = await database
      .select({
        id: posts.id,
        memberId: posts.memberId,
        title: posts.title,
        url: posts.url,
      })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .limit(1);

    if (!post) {
      return Errors.notFound('포스트를 찾을 수 없습니다.').toResponse();
    }

    // 권한 체크: 본인 또는 관리자
    const [member] = await database
      .select({ id: members.id, discordId: members.discordId })
      .from(members)
      .where(eq(members.id, post.memberId))
      .limit(1);

    const isOwner = member?.discordId === discordId;
    const isAdmin = await isAdminDiscordId(discordId);

    if (!isOwner && !isAdmin) {
      return Errors.forbidden('삭제 권한이 없습니다.').toResponse();
    }

    // 포스트는 soft delete (URL 보존 → RSS 재수집 방지)
    // 댓글/조회/리액션/점수는 hard delete (복원 시 이전 데이터가 새 포스트에 살아남는 것 방지)
    await database.transaction(async (tx) => {
      // 1. 댓글 hard delete
      await tx.delete(postComments).where(eq(postComments.postId, postId));

      // 2. 조회 기록 hard delete
      await tx.delete(postViews).where(eq(postViews.postId, postId));

      // 2b. 리액션 hard delete (복원 시 인기점수 부풀림 차단)
      await tx.delete(postReactions).where(eq(postReactions.postId, postId));

      // 3. blog_post 점수 회수
      // 봇: "블로그 포스트: {title(특수문자 제거, 200자)}", 수동: "블로그 포스트: {title(200자)}"
      // LIKE로 제목 앞 50자 prefix 매칭 (봇/수동 포맷 차이 대응)
      const titlePrefix = post.title.replace(/[%_\\]/g, '\\$&').slice(0, 50);
      await tx
        .delete(activityScores)
        .where(
          and(
            eq(activityScores.memberId, post.memberId),
            eq(activityScores.type, ActivityScoreType.BLOG_POST),
            like(activityScores.description, `블로그 포스트: ${titlePrefix}%`)
          )
        );

      // 4. 포스트 soft delete (URL은 unique constraint로 남아 RSS 재수집 차단)
      await tx.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, postId));
    });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Post delete error:', error);
    return errorResponse(error);
  }
}
