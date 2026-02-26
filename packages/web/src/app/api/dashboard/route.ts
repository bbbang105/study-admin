import { NextResponse } from 'next/server';
import { eq, desc, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';

const { members, posts, rounds, MemberStatus } = sharedDb;

/**
 * GET /api/dashboard
 * Get dashboard data including current round info and recent posts
 * Requirement: 18.1
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const database = db();

    // Get current round
    const [currentRoundData] = await database
      .select()
      .from(rounds)
      .where(eq(rounds.isCurrent, true))
      .limit(1);

    let currentRound = null;
    if (currentRoundData) {
      const now = new Date();
      const endDate = new Date(currentRoundData.endDate);
      const graceEndDate = new Date(currentRoundData.graceEndDate);
      
      // Calculate days remaining
      const timeDiff = endDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      // Check if in grace period
      const isGracePeriod = now > endDate && now <= graceEndDate;

      currentRound = {
        roundNumber: currentRoundData.roundNumber,
        startDate: currentRoundData.startDate,
        endDate: currentRoundData.endDate,
        graceEndDate: currentRoundData.graceEndDate,
        daysRemaining: Math.max(0, daysRemaining),
        isGracePeriod,
      };
    }

    // Get recent posts with member info
    const recentPostsResult = await database
      .select({
        id: posts.id,
        title: posts.title,
        url: posts.url,
        publishedAt: posts.publishedAt,
        memberName: members.name,
        memberDiscordUsername: members.discordUsername,
      })
      .from(posts)
      .leftJoin(members, eq(posts.memberId, members.id))
      .orderBy(desc(posts.publishedAt))
      .limit(5);

    // Get total active members count
    const totalMembersResult = await database
      .select({ count: count() })
      .from(members)
      .where(eq(members.status, MemberStatus.ACTIVE));

    // Get total posts count
    const totalPostsResult = await database
      .select({ count: count() })
      .from(posts);

    return NextResponse.json({
      currentRound,
      recentPosts: recentPostsResult.map((post) => ({
        id: post.id,
        title: post.title,
        url: post.url,
        publishedAt: post.publishedAt?.toISOString(),
        memberName: post.memberName,
        memberDiscordUsername: post.memberDiscordUsername,
      })),
      totalMembers: totalMembersResult[0]?.count ?? 0,
      totalPosts: totalPostsResult[0]?.count ?? 0,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
