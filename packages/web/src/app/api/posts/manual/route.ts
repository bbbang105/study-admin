import { after, NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { isSafeUrl } from '@/lib/rss-detect';
import { sendDiscordChannelMessage } from '@/lib/discord-notify';
import { sendPushToMembers } from '@/lib/push';
import { decodeHtmlEntities } from '@/lib/sanitize';

const {
  posts,
  members,
  rounds,
  attendance,
  fines,
  ActivityScoreType,
  AttendanceStatus,
  FineStatus,
  FineType,
} = sharedDb;

const BLOG_POST_POINTS = 30;
const BLOG_POST_DAILY_CAP = 60;

function getTodayDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0]!;
}

/**
 * OG 태그에서 제목, 발행일, 썸네일, 설명 추출
 */
async function fetchOgData(url: string): Promise<{
  title: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  description: string | null;
}> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok)
      return { title: null, publishedAt: null, thumbnailUrl: null, description: null };

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

    // og:image
    const ogImageMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    let thumbnailUrl = ogImageMatch?.[1] || null;
    if (thumbnailUrl && !isSafeUrl(thumbnailUrl)) thumbnailUrl = null;

    // og:description > meta description
    const ogDescMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
    const metaDescMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const rawDesc = ogDescMatch?.[1] || metaDescMatch?.[1] || null;
    const description = rawDesc ? rawDesc.trim().slice(0, 300) : null;

    return { title: title?.trim() || null, publishedAt, thumbnailUrl, description };
  } catch {
    return { title: null, publishedAt: null, thumbnailUrl: null, description: null };
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
    const {
      url,
      title: manualTitle,
      description: manualDescription,
      thumbnailUrl: manualThumbnailUrl,
      notifyDiscord: shouldNotify = true,
    } = body;

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
      .select({
        id: members.id,
        discordId: members.discordId,
        discordUsername: members.discordUsername,
        name: members.name,
        part: members.part,
        profileImageUrl: members.profileImageUrl,
        status: members.status,
      })
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

    // 클라이언트에서 미리보기 후 편집된 값 우선 사용, 없으면 OG 크롤링
    let title = (manualTitle as string | null) || null;
    let publishedAt: Date = new Date();
    let thumbnailUrl = (manualThumbnailUrl as string | null) || null;
    let description = (manualDescription as string | null) || null;

    if (!title) {
      const ogData = await fetchOgData(url);
      if (!thumbnailUrl) thumbnailUrl = ogData.thumbnailUrl;
      if (!description) description = ogData.description;

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
      .select({
        id: rounds.id,
        roundNumber: rounds.roundNumber,
        endDate: rounds.endDate,
        graceEndDate: rounds.graceEndDate,
      })
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
        thumbnailUrl,
        description,
      })
      .returning();

    // 출석 상태 업데이트 (현재 회차 + active 유저만)
    if (currentRound && member.status === 'active') {
      const now = new Date();
      // 정상 마감: graceEndDate(월요일) 00:00 KST, 이후 지각
      const submissionDeadline = new Date(`${currentRound.graceEndDate}T00:00:00.000+09:00`);

      const isLate = now > submissionDeadline;

      // 기존 출석 레코드 확인
      const [existingAtt] = await database
        .select()
        .from(attendance)
        .where(and(eq(attendance.memberId, member.id), eq(attendance.roundId, currentRound.id)))
        .limit(1);

      const newStatus = isLate ? AttendanceStatus.LATE : AttendanceStatus.SUBMITTED;

      if (!existingAtt) {
        // 출석 레코드가 없으면 생성
        await database.insert(attendance).values({
          memberId: member.id,
          roundId: currentRound.id,
          status: newStatus,
          submittedAt: now,
          updatedAt: now,
        });
      } else if (existingAtt.status === AttendanceStatus.PENDING) {
        // PENDING 상태일 때만 업데이트 (이미 SUBMITTED/LATE/ABSENT이면 유지)
        await database
          .update(attendance)
          .set({
            status: newStatus,
            submittedAt: now,
            updatedAt: now,
          })
          .where(eq(attendance.id, existingAtt.id));
      }

      // 지각이면 벌금 부과 (중복 방지)
      if (isLate && (!existingAtt || existingAtt.status === AttendanceStatus.PENDING)) {
        const [existingFine] = await database
          .select()
          .from(fines)
          .where(and(eq(fines.memberId, member.id), eq(fines.roundId, currentRound.id)))
          .limit(1);

        if (!existingFine) {
          await database.insert(fines).values({
            memberId: member.id,
            roundId: currentRound.id,
            type: FineType.LATE,
            amount: 3000,
            status: FineStatus.UNPAID,
          });
        }
      }
    }

    // 블로그 포스트 점수 부여 (30점, 일일 60점 상한) — active 유저만
    if (member.status === 'active') {
      const today = getTodayDateString();
      const safeTitle = title.slice(0, 200);
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
    }

    // Discord 새 글 알림 (fire-and-forget)
    if (shouldNotify && newPost) {
      after(async () => {
        try {
          const database2 = db();
          const { config } = sharedDb;
          const [channelRow] = await database2
            .select({ value: config.value })
            .from(config)
            .where(eq(config.key, 'announcement_channel_id'))
            .limit(1);

          const channelId = channelRow?.value;
          if (!channelId) return;

          const roundText = currentRound ? `${currentRound.roundNumber}회차` : null;

          const postUrl = `https://kusting-web.vercel.app/posts/${newPost!.id}`;

          await sendDiscordChannelMessage({
            channelId,
            content: `<@${member.discordId}>님이 새 글을 발행했습니다! 🎉`,
            embeds: [
              {
                title: `📝 ${title!.slice(0, 200)}`,
                url,
                description: description ? description.slice(0, 200) : undefined,
                color: 0x5865f2,
                image: thumbnailUrl ? { url: thumbnailUrl } : undefined,
                author: {
                  name: member.discordUsername,
                  icon_url: member.profileImageUrl || undefined,
                },
                fields: roundText
                  ? [{ name: '📅 회차', value: roundText, inline: true }]
                  : undefined,
                timestamp: publishedAt.toISOString(),
                footer: { text: `${member.name} • ${member.part}` },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 5, label: '블로그 원문 보기', url, emoji: { name: '📖' } },
                  {
                    type: 2,
                    style: 5,
                    label: '큐스팅 웹에서 보기',
                    url: postUrl,
                    emoji: { name: '🔗' },
                  },
                ],
              },
            ],
          });
        } catch (e) {
          console.error('[manual-post] Discord 알림 전송 실패:', e);
        }
      });
    }

    // 푸시 알림 (Discord 토글과 무관하게 항상 발송)
    if (newPost) {
      after(async () => {
        try {
          const database3 = db();
          const allMembers = await database3
            .select({ id: members.id })
            .from(members)
            .where(inArray(members.status, ['active', 'ob', 'dormant']));

          const targetIds = allMembers.map((m) => m.id).filter((id) => id !== member.id);

          if (targetIds.length > 0) {
            await sendPushToMembers(targetIds, {
              title: '📝 새 글이 등록되었어요',
              body: `${member.name}님이 새 글을 등록했어요: ${decodeHtmlEntities(title!).slice(0, 100)}`,
              clickUrl: `/posts/${newPost!.id}`,
              data: { type: 'new_post' },
            });
          }
        } catch (e) {
          console.error('[manual-post] 푸시 알림 전송 실패:', e);
        }
      });
    }

    return successResponse({ post: newPost }, '글이 등록되었습니다.');
  } catch (error) {
    console.error('Manual post API error:', error);
    return errorResponse(error);
  }
}
