import { NextRequest } from 'next/server';
import { withAdminAuth } from '@/lib/admin';
import { Errors, successResponse } from '@/lib/api-error';

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001';
const BOT_API_SECRET = process.env.BOT_API_SECRET;

/**
 * Map operation IDs to bot API endpoints
 */
const OPERATION_ENDPOINT_MAP: Record<string, string> = {
  'rss-poll': '/api/trigger/rss-poll',
  'attendance-check': '/api/trigger/attendance-check',
  'fine-reminder': '/api/trigger/fine-reminder',
  'round-report': '/api/trigger/round-report',
  'round-start': '/api/trigger/round-start',
  'curation-crawl': '/api/trigger/curation-crawl',
  'curation-share': '/api/trigger/curation-share',
  'weekly-ranking': '/api/trigger/weekly-ranking',
  'popular-posts': '/api/trigger/popular-posts',
  'deadline-reminder-d2': '/api/trigger/deadline-reminder',
  'deadline-reminder-d1': '/api/trigger/deadline-reminder',
  'deadline-reminder-d0': '/api/trigger/deadline-reminder',
};

/**
 * Validate operation ID
 */
function isValidOperationId(
  operationId: string
): operationId is keyof typeof OPERATION_ENDPOINT_MAP {
  return operationId in OPERATION_ENDPOINT_MAP;
}

/**
 * POST /api/admin/bot-operations/[operationId]
 * Trigger a bot operation via HTTP request to bot server
 */
export const POST = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  const { pathname } = new URL(request.url);
  const operationId = pathname.split('/').pop();

  if (!operationId || !isValidOperationId(operationId)) {
    return Errors.notFound('알 수 없는 작업 ID입니다').toResponse();
  }

  const endpoint = OPERATION_ENDPOINT_MAP[operationId]!;
  const botUrl = `${BOT_API_URL}${endpoint}`;

  console.log(`[Bot Operations] Triggering: ${operationId}`);

  try {
    // Forward request to bot server
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    // Forward request body (for operations that accept parameters like pollId, dDay)
    let body: string | undefined;

    // deadline-reminder-d* → dDay 파라미터 자동 주입
    const deadlineMatch = operationId.match(/^deadline-reminder-d(\d)$/);
    if (deadlineMatch) {
      body = JSON.stringify({ dDay: Number(deadlineMatch[1]) });
    } else {
      try {
        const json = await request.json();
        if (json && Object.keys(json).length > 0) {
          body = JSON.stringify(json);
        }
      } catch {
        // No body or invalid JSON — fine, send without body
      }
    }

    const response = await fetch(botUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BOT_API_SECRET && { Authorization: `Bearer ${BOT_API_SECRET}` }),
      },
      ...(body && { body }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bot Operations] Bot server error: ${response.status} ${errorText}`);

      // Map common error codes
      if (response.status === 409) {
        return Errors.conflict('작업이 이미 실행 중입니다').toResponse();
      }

      return Errors.externalServiceError('봇 서버에서 오류가 발생했습니다.').toResponse();
    }

    const result = await response.json();

    return successResponse({
      operationId,
      result,
      message: '작업이 시작되었습니다',
    });
  } catch (error) {
    console.error(`[Bot Operations] Failed to reach bot server:`, error);

    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      return Errors.externalServiceError('봇 서버 응답 시간 초과 (30초)').toResponse();
    }

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    // Check if it's a connection error
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      return Errors.externalServiceError(
        '봇 서버에 연결할 수 없습니다. 봇이 실행 중인지 확인해주세요.'
      ).toResponse();
    }

    return Errors.externalServiceError('봇 서버 통신 오류').toResponse();
  }
});
