import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { getTodayDateString, SCORE_CONFIG } from '@/lib/score';

const { posts, members, activityScores, ActivityScoreType } = sharedDb;

/**
 * POST /api/posts/[id]/view
 * 포스트 조회 시 활동 점수 부여
 * - 본인 글 제외
 * - 같은 글 중복 조회 불가 (post_views UNIQUE)
 * - 단일 CTE로 post_views insert + 점수 부여를 원자적으로 처리
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: postId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ scored: false }, { status: 401 });
    }

    const discordIdentity = user.identities?.find((identity) => identity.provider === 'discord');
    const discordId = discordIdentity?.id;
    if (!discordId) {
      return NextResponse.json({ scored: false }, { status: 400 });
    }

    const database = getDb();

    const [member] = await database
      .select({ id: members.id })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!member) {
      return NextResponse.json({ scored: false }, { status: 404 });
    }

    // 포스트 존재 확인 + 작성자 체크
    const [post] = await database
      .select({ id: posts.id, memberId: posts.memberId, title: posts.title })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json({ scored: false }, { status: 404 });
    }

    // 본인 글 제외
    if (post.memberId === member.id) {
      return NextResponse.json({ scored: false, reason: 'own_post' });
    }

    const config = SCORE_CONFIG[ActivityScoreType.POST_VIEW];
    const safeTitle = post.title.replace(/[<>"'&]/g, '').slice(0, 200);
    const desc = safeTitle;
    const today = getTodayDateString();

    // 단일 CTE: post_views insert + 일일 상한 체크 + 점수 부여 (원자적)
    const result = await database.execute(sql`
      WITH view_insert AS (
        INSERT INTO post_views (id, member_id, post_id)
        VALUES (gen_random_uuid(), ${member.id}, ${postId})
        ON CONFLICT (member_id, post_id) DO NOTHING
        RETURNING id
      ),
      daily AS (
        SELECT COALESCE(SUM(${activityScores.points}), 0) AS total
        FROM ${activityScores}
        WHERE ${activityScores.memberId} = ${member.id}
          AND ${activityScores.type} = ${ActivityScoreType.POST_VIEW}
          AND ${activityScores.date} = ${today}
      )
      INSERT INTO activity_scores (id, member_id, type, points, description, date)
      SELECT gen_random_uuid(), ${member.id}, ${ActivityScoreType.POST_VIEW}, ${config.points},
        ${desc}, ${today}
      FROM view_insert, daily
      WHERE daily.total < ${config.dailyCap}
      RETURNING points
    `);

    const scored = result.length > 0;

    return NextResponse.json({
      scored,
      points: scored ? config.points : 0,
      reason: scored ? 'success' : 'already_viewed_or_daily_cap',
    });
  } catch (error) {
    console.error('Post view API error:', error);
    return NextResponse.json({ scored: false }, { status: 500 });
  }
}
