import { eq, and, like } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { isAdminDiscordId } from '@/lib/admin';

const { posts, members, postComments, postViews, activityScores, ActivityScoreType } = sharedDb;

/**
 * DELETE /api/posts/[id]
 * 포스트 삭제 (본인 또는 관리자만)
 * - 관련 댓글, 조회 기록, 활동 점수(blog_post) 함께 삭제
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 포스트 조회
    const [post] = await database
      .select({
        id: posts.id,
        memberId: posts.memberId,
        title: posts.title,
        url: posts.url,
      })
      .from(posts)
      .where(eq(posts.id, postId))
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

    // 트랜잭션으로 일괄 삭제
    await database.transaction(async (tx) => {
      // 1. 댓글 삭제
      await tx.delete(postComments).where(eq(postComments.postId, postId));

      // 2. 조회 기록 삭제
      await tx.delete(postViews).where(eq(postViews.postId, postId));

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

      // 4. 포스트 삭제
      await tx.delete(posts).where(eq(posts.id, postId));
    });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Post delete error:', error);
    return errorResponse(error);
  }
}
