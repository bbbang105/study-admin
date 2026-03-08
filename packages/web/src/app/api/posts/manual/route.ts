import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { isSafeUrl } from '@/lib/rss-detect';

const { posts, members, rounds, ActivityScoreType } = sharedDb;

const BLOG_POST_POINTS = 30;
const BLOG_POST_DAILY_CAP = 60;

function getTodayDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0]!;
}

/**
 * OG 태그에서 제목과 발행일 추출
 */
async function fetchOgData(
  url: string
): Promise<{ title: string | null; publishedAt: string | null }> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return { title: null, publishedAt: null };

    const html = await response.text();

    // title: og:title > <title>
    const ogTitleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || null;

    // publishedAt: article:published_time
    const pubMatch =
      html.match(
        /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i
      ) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i);
    const publishedAt = pubMatch?.[1] || null;

    return { title: title?.trim() || null, publishedAt };
  } catch {
    return { title: null, publishedAt: null };
  }
}

/**
 * POST /api/posts/manual
 * 수동 글 등록 (OG 크롤링 → 실패 시 제목 직접 입력)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Errors.unauthorized().toResponse();
    }

    const discordIdentity = user.identities?.find((identity) => identity.provider === 'discord');
    const discordId = discordIdentity?.id;
    if (!discordId) {
      return Errors.badRequest('Discord 계정이 필요합니다.').toResponse();
    }

    const body = await request.json();
    const { url, title: manualTitle } = body;

    if (!url || typeof url !== 'string') {
      return Errors.badRequest('URL은 필수입니다.').toResponse();
    }

    // URL 형식 및 SSRF 검증
    if (!isSafeUrl(url)) {
      return Errors.badRequest('유효하지 않은 URL입니다.').toResponse();
    }

    const database = db();

    // 멤버 조회
    const [member] = await database
      .select({ id: members.id })
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    if (!member) {
      return Errors.notFound('멤버 정보를 찾을 수 없습니다.').toResponse();
    }

    // 중복 URL 체크
    const [existing] = await database
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.url, url))
      .limit(1);

    if (existing) {
      return Errors.conflict('이미 등록된 URL입니다.').toResponse();
    }

    // OG 크롤링 시도
    let title = manualTitle as string | null;
    let publishedAt: Date = new Date();

    if (!title) {
      const ogData = await fetchOgData(url);
      if (ogData.title) {
        title = ogData.title;
        if (ogData.publishedAt) {
          publishedAt = new Date(ogData.publishedAt);
        }
      }
    }

    // 크롤링 실패 + 수동 제목 없음 → 422로 클라이언트에 제목 입력 요청
    // 의도적으로 표준 에러 엔벨로프 대신 { needsTitle: true } 사용 (posts/page.tsx에서 분기 처리)
    if (!title) {
      return NextResponse.json(
        { message: '제목을 자동으로 가져올 수 없습니다. 직접 입력해주세요.', needsTitle: true },
        { status: 422 }
      );
    }

    // 현재 회차 조회
    const [currentRound] = await database
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.isCurrent, true))
      .limit(1);

    // 포스트 등록
    const [newPost] = await database
      .insert(posts)
      .values({
        memberId: member.id,
        roundId: currentRound?.id ?? null,
        title,
        url,
        publishedAt,
      })
      .returning();

    // 블로그 포스트 점수 부여 (30점, 일일 60점 상한)
    const today = getTodayDateString();
    const safeTitle = title.replace(/[<>"'&]/g, '').slice(0, 200);
    await database.execute(sql`
      WITH daily AS (
        SELECT COALESCE(SUM(points), 0) AS total
        FROM activity_scores
        WHERE member_id = ${member.id}
          AND type = ${ActivityScoreType.BLOG_POST}
          AND date = ${today}
      )
      INSERT INTO activity_scores (id, member_id, type, points, description, date)
      SELECT gen_random_uuid(), ${member.id}, ${ActivityScoreType.BLOG_POST}, ${BLOG_POST_POINTS},
        ${`블로그 포스트: ${safeTitle}`}, ${today}
      FROM daily
      WHERE daily.total < ${BLOG_POST_DAILY_CAP}
      RETURNING points
    `);

    return successResponse({ post: newPost }, '글이 등록되었습니다.');
  } catch (error) {
    console.error('Manual post API error:', error);
    return errorResponse(error);
  }
}
