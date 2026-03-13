import { NextRequest } from 'next/server';
import { withAdminAuth } from '@/lib/admin';
import { Errors, successResponse } from '@/lib/api-error';

/**
 * Bot API endpoint URL (EC2 server)
 * TODO: Move to environment variable
 */
const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001';

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
};

/**
 * Validate operation ID
 */
function isValidOperationId(operationId: string): operationId is keyof typeof OPERATION_ENDPOINT_MAP {
  return operationId in OPERATION_ENDPOINT_MAP;
}

/**
 * POST /api/admin/bot-operations/[operationId]
 * Trigger a bot operation via HTTP request to bot server
 */
export const POST = withAdminAuth(async (
  request: NextRequest,
  _adminAuth
) => {
  const operationId = request.url.split('/').pop();

  if (!operationId || !isValidOperationId(operationId)) {
    return Errors.notFound('알 수 없는 작업 ID입니다').toResponse();
  }

  const endpoint = OPERATION_ENDPOINT_MAP[operationId]!;
  const botUrl = `${BOT_API_URL}${endpoint}`;

  console.log(`[Bot Operations] Forwarding request to bot: ${botUrl}`);

  try {
    // Forward request to bot server
    const response = await fetch(botUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication header if bot server requires it
        'X-Admin-Trigger': 'true',
      },
      // Don't forward body for now (not needed for triggers)
      // body: request.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bot Operations] Bot server error: ${response.status} ${errorText}`);

      // Map common error codes
      if (response.status === 409) {
        return Errors.conflict('작업이 이미 실행 중입니다').toResponse();
      }

      return Errors.externalServiceError(
        `봇 서버 오류: ${response.status} ${errorText}`
      ).toResponse();
    }

    const result = await response.json();

    return successResponse({
      operationId,
      result,
      message: '작업이 시작되었습니다',
    });
  } catch (error) {
    console.error(`[Bot Operations] Failed to reach bot server:`, error);

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    // Check if it's a connection error
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      return Errors.externalServiceError(
        '봇 서버에 연결할 수 없습니다. 봇이 실행 중인지 확인해주세요.'
      ).toResponse();
    }

    return Errors.externalServiceError(errorMessage).toResponse();
  }
});
