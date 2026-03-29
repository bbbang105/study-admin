import { NextRequest } from 'next/server';
import { withAdminAuth } from '@/lib/admin';
import { Errors, successResponse } from '@/lib/api-error';

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001';
const BOT_API_SECRET = process.env.BOT_API_SECRET;

/**
 * POST /api/admin/poll-reminder
 * 특정 투표의 미참여자에게 DM 발송 (관리자 전용)
 * Body: { pollId: string, discordId?: string }
 * discordId 지정 시 해당 멤버에게만 발송, 미지정 시 전체 미참여자
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  let pollId: string | undefined;
  let discordId: string | undefined;

  try {
    const body = await request.json();
    pollId = body.pollId;
    discordId = body.discordId;
  } catch {
    return Errors.badRequest('잘못된 요청 형식입니다').toResponse();
  }

  if (!pollId || typeof pollId !== 'string') {
    return Errors.badRequest('pollId가 필요합니다').toResponse();
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${BOT_API_URL}/api/trigger/poll-reminder-dm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BOT_API_SECRET && { Authorization: `Bearer ${BOT_API_SECRET}` }),
      },
      body: JSON.stringify({ pollId, ...(discordId && { discordId }) }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 409) {
        return Errors.conflict('투표 리마인더가 이미 실행 중입니다').toResponse();
      }
      return Errors.externalServiceError('봇 서버에서 오류가 발생했습니다').toResponse();
    }

    const result = await response.json();
    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return Errors.externalServiceError('봇 서버 응답 시간 초과').toResponse();
    }

    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return Errors.externalServiceError('봇 서버에 연결할 수 없습니다').toResponse();
    }

    return Errors.externalServiceError('봇 서버 통신 오류').toResponse();
  }
});
