import { NextRequest } from 'next/server';
import { desc, eq, and, lt, isNull, isNotNull, type SQL } from 'drizzle-orm';
import { db as sharedDb } from '@blog-study/shared';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin';
import { successResponse, Errors, withCache } from '@/lib/api-error';

const { discordNotificationLogs } = sharedDb;

/**
 * GET /api/admin/bot-logs
 * 봇 Discord 알림 로그 조회 (페이지네이션 + 필터링)
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const source = searchParams.get('source');
    const status = searchParams.get('status');
    const target = searchParams.get('target'); // 'channel' | 'dm'
    const cursor = searchParams.get('cursor'); // ISO timestamp
    const limit = Math.min(Number(searchParams.get('limit') || 20), 50);

    const database = db();
    const conditions: SQL[] = [];

    if (type) conditions.push(eq(discordNotificationLogs.type, type));
    if (source) conditions.push(eq(discordNotificationLogs.source, source));
    if (status) conditions.push(eq(discordNotificationLogs.status, status));
    if (cursor) {
      conditions.push(lt(discordNotificationLogs.createdAt, new Date(cursor)));
    }
    if (target === 'channel') {
      conditions.push(isNull(discordNotificationLogs.targetDiscordId));
    } else if (target === 'dm') {
      conditions.push(isNotNull(discordNotificationLogs.targetDiscordId));
    }

    const logs = await database
      .select()
      .from(discordNotificationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(discordNotificationLogs.createdAt))
      .limit(limit + 1);

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1]!.createdAt.toISOString()
        : null;

    return withCache(successResponse({ logs: items, nextCursor, hasMore }), 10);
  } catch (error) {
    console.error('Bot logs API error:', error);
    return Errors.internalError().toResponse();
  }
});
