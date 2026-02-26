import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';

const { posts, members, activityScores, ActivityScoreType } = sharedDb;

const POST_VIEW_POINTS = 2;
const POST_VIEW_DAILY_CAP = 10;

function getTodayDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0]!;
}

/**
 * POST /api/posts/[id]/view
 * 글 조회 시 활동 점수 부여
 * - 본인 글 제외
 * - 같은 글 중복 조회 불가 (post_views UNIQUE)
 * - 하루 최대 5회 (10점)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ scored: false }, { status: 401 });
    }

    const discordIdentity = user.identities?.find(
      (identity) => identity.provider === 'discord'
    );
    const discordId = discordIdentity?.id;
    if (!discordId) {
      return NextResponse.json({ scored: false }, { status: 400 });
    }

    const database = db();

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

    // 중복 조회 체크 + 삽입 (INSERT ON CONFLICT DO NOTHING)
    const insertResult = await database.execute(sql`
      INSERT INTO post_views (id, member_id, post_id)
      VALUES (gen_random_uuid(), ${member.id}, ${postId})
      ON CONFLICT (member_id, post_id) DO NOTHING
      RETURNING id
    `);

    if (insertResult.length === 0) {
      return NextResponse.json({ scored: false, reason: 'already_viewed' });
    }

    // 일일 상한 체크 후 점수 부여 (원자적 CTE)
    const today = getTodayDateString();
    const safeTitle = post.title.replace(/[<>"'&]/g, '').slice(0, 200);
    const scoreResult = await database.execute(sql`
      WITH daily AS (
        SELECT COALESCE(SUM(${activityScores.points}), 0) AS total
        FROM ${activityScores}
        WHERE ${activityScores.memberId} = ${member.id}
          AND ${activityScores.type} = ${ActivityScoreType.POST_VIEW}
          AND ${activityScores.date} = ${today}
      )
      INSERT INTO activity_scores (id, member_id, type, points, description, date)
      SELECT gen_random_uuid(), ${member.id}, ${ActivityScoreType.POST_VIEW}, ${POST_VIEW_POINTS},
        ${`글 조회: ${safeTitle}`}, ${today}
      FROM daily
      WHERE daily.total < ${POST_VIEW_DAILY_CAP}
      RETURNING points
    `);

    const scored = scoreResult.length > 0;

    return NextResponse.json({
      scored,
      points: scored ? POST_VIEW_POINTS : 0,
      reason: scored ? 'success' : 'daily_cap',
    });
  } catch (error) {
    console.error('Post view API error:', error);
    return NextResponse.json({ scored: false }, { status: 500 });
  }
}
