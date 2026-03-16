import { NextRequest } from 'next/server';
import { getBoardAuth } from '@/lib/board-auth';
import { sendPushToMember } from '@/lib/push';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';

const TEST_MESSAGES: Record<string, { title: string; body: string }> = {
  board_comment: {
    title: '💬 게시판 댓글 테스트',
    body: '누군가 내 게시글에 댓글을 남겼습니다.',
  },
  board_reply: {
    title: '↩️ 게시판 답글 테스트',
    body: '누군가 내 댓글에 답글을 남겼습니다.',
  },
  post_comment: {
    title: '📝 포스트 댓글 테스트',
    body: '누군가 내 포스트에 댓글을 남겼습니다.',
  },
  post_reply: {
    title: '↩️ 포스트 답글 테스트',
    body: '누군가 내 포스트 댓글에 답글을 남겼습니다.',
  },
  board_notice: {
    title: '📢 공지사항 테스트',
    body: '새로운 공지사항이 게시되었습니다.',
  },
};

// 유저별 레이트 리밋 (분당 5회)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(memberId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(memberId) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(memberId, recent);
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    if (!checkRateLimit(auth.memberId)) {
      return Errors.badRequest('테스트 알림은 1분에 5회까지 가능합니다.').toResponse();
    }

    const { type } = await request.json();

    const message = TEST_MESSAGES[type];
    if (!message) {
      return Errors.badRequest('잘못된 알림 타입입니다.').toResponse();
    }

    const result = await sendPushToMember(auth.memberId, {
      title: message.title,
      body: message.body,
      clickUrl: '/profile/notifications',
      data: { type },
    });

    return successResponse(result, '테스트 알림이 전송되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
