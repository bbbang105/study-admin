import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { config, members, rounds } from '@blog-study/shared/db';
import { getAdminDiscordIds, getEnvAdminIds, withAdminAuth } from '@/lib/admin';
import { generateAllRoundDates, getPreviousMonday, isMonday } from '@blog-study/shared/utils';
import { errorResponse } from '@/lib/api-error';

function formatDateToString(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

/**
 * GET /api/admin/settings
 * Get all study settings
 * Requirements: 16.10
 */
export const GET = withAdminAuth(async (_request: NextRequest, adminAuth) => {
  try {
    const database = getDb();

    // Get all config values
    const configRows = await database.select().from(config);

    // Convert to object
    const settings: Record<string, string> = {};
    for (const row of configRows) {
      settings[row.key] = row.value;
    }

    // Get current round info
    const [currentRound] = await database
      .select()
      .from(rounds)
      .where(eq(rounds.isCurrent, true))
      .limit(1);

    // Get total rounds count
    const allRounds = await database.select().from(rounds);

    // Get merged admin IDs and resolve member info
    const adminIds = await getAdminDiscordIds();
    const envAdminIds = new Set(getEnvAdminIds());

    let adminMembers: { discordId: string; name: string; nickname: string; isEnv: boolean }[] = [];
    if (adminIds.length > 0) {
      const memberRows = await database
        .select({
          discordId: members.discordId,
          name: members.name,
          nickname: members.nickname,
        })
        .from(members)
        .where(inArray(members.discordId, adminIds));

      const memberMap = new Map(memberRows.map((m) => [m.discordId, m]));

      adminMembers = adminIds.map((id) => {
        const member = memberMap.get(id);
        return {
          discordId: id,
          name: member?.name ?? id,
          nickname: member?.nickname ?? '',
          isEnv: envAdminIds.has(id),
        };
      });
    }

    return NextResponse.json({
      settings: {
        studyStartDate: settings['study_start_date'] || null,
        totalRounds: settings['total_rounds'] || '10',
        announcementChannelId: settings['announcement_channel_id'] || null,
        noticeChannelId: settings['notice_channel_id'] || null,
        rankingChannelId: settings['ranking_channel_id'] || null,
        popularPostsChannelId: settings['popular_posts_channel_id'] || null,
        botLogChannelId: settings['bot_log_channel_id'] || null,
        adminNotificationChannelId: settings['admin_notification_channel_id'] || null,
        adminDiscordIds: settings['admin_discord_ids'] || '',
        studyRoleId: settings['study_role_id'] || null,
      },
      currentRound: currentRound || null,
      totalRoundsCreated: allRounds.length,
      adminMembers,
      currentUserDiscordId: adminAuth.discordId ?? null,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return errorResponse(error);
  }
});

/**
 * PATCH /api/admin/settings
 * Update study settings
 * Requirements: 16.11
 */
export const PATCH = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const body = await request.json();
    const database = getDb();
    const now = new Date();

    // Map of frontend keys to database keys
    const keyMap: Record<string, string> = {
      studyStartDate: 'study_start_date',
      totalRounds: 'total_rounds',
      announcementChannelId: 'announcement_channel_id',
      noticeChannelId: 'notice_channel_id',
      rankingChannelId: 'ranking_channel_id',
      popularPostsChannelId: 'popular_posts_channel_id',
      botLogChannelId: 'bot_log_channel_id',
      adminNotificationChannelId: 'admin_notification_channel_id',
      adminDiscordIds: 'admin_discord_ids',
      studyRoleId: 'study_role_id',
    };

    // Discord snowflake 형식 검증 (채널/역할 ID)
    const SNOWFLAKE_RE = /^\d{17,20}$/;
    const snowflakeKeys = new Set([
      'announcement_channel_id',
      'notice_channel_id',
      'ranking_channel_id',
      'popular_posts_channel_id',
      'bot_log_channel_id',
      'admin_notification_channel_id',
      'study_role_id',
    ]);

    // Update each setting
    for (const [frontendKey, value] of Object.entries(body)) {
      const dbKey = keyMap[frontendKey];
      if (!dbKey || value === undefined) continue;

      const stringValue = String(value);

      // snowflake 형식 검증 (빈 값은 허용)
      if (
        snowflakeKeys.has(dbKey) &&
        stringValue &&
        stringValue !== 'null' &&
        !SNOWFLAKE_RE.test(stringValue)
      ) {
        continue; // 유효하지 않은 snowflake는 무시
      }

      // Check if key exists
      const [existing] = await database.select().from(config).where(eq(config.key, dbKey)).limit(1);

      if (existing) {
        // Update existing
        await database
          .update(config)
          .set({ value: stringValue, updatedAt: now })
          .where(eq(config.key, dbKey));
      } else {
        // Insert new
        await database.insert(config).values({
          key: dbKey,
          value: stringValue,
          updatedAt: now,
        });
      }
    }

    // Generate rounds only if studyStartDate or totalRounds actually changed
    let roundsCreated = 0;
    if (body.studyStartDate && body.totalRounds) {
      // 기존 설정과 비교하여 변경됐을 때만 회차 재생성
      const configRows = await database.select().from(config);
      const currentSettings: Record<string, string> = {};
      for (const row of configRows) {
        currentSettings[row.key] = row.value;
      }

      const prevStartDate = currentSettings['study_start_date'] || '';
      const prevTotalRounds = currentSettings['total_rounds'] || '';

      if (body.studyStartDate !== prevStartDate || String(body.totalRounds) !== prevTotalRounds) {
        const totalRounds = Math.max(1, Math.min(52, Number(body.totalRounds)));
        let startDate = new Date(body.studyStartDate);

        // Adjust to previous Monday if not already Monday
        if (!isMonday(startDate)) {
          startDate = getPreviousMonday(startDate);
        }

        const roundDatesList = generateAllRoundDates(startDate, totalRounds);
        const roundRecords = roundDatesList.map((rd, index) => ({
          roundNumber: rd.roundNumber,
          startDate: formatDateToString(rd.startDate),
          endDate: formatDateToString(rd.endDate),
          graceEndDate: formatDateToString(rd.graceEndDate),
          isCurrent: index === 0,
        }));

        // Delete existing rounds and recreate
        await database.delete(rounds);
        await database.insert(rounds).values(roundRecords);
        roundsCreated = roundRecords.length;
      }
    }

    return NextResponse.json({ success: true, roundsCreated });
  } catch (error) {
    console.error('Error updating settings:', error);
    return errorResponse(error);
  }
});
