import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { config, rounds } from '@blog-study/shared/db';
import { verifyAdminAccess } from '@/lib/admin';

/**
 * GET /api/admin/settings
 * Get all study settings
 * Requirements: 16.10
 */
export async function GET() {
  try {
    // Check admin access
    const adminCheck = await verifyAdminAccess();
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getDb();

    // Get all config values
    const configRows = await db.select().from(config);
    
    // Convert to object
    const settings: Record<string, string> = {};
    for (const row of configRows) {
      settings[row.key] = row.value;
    }

    // Get current round info
    const [currentRound] = await db
      .select()
      .from(rounds)
      .where(eq(rounds.isCurrent, true))
      .limit(1);

    // Get total rounds count
    const allRounds = await db.select().from(rounds);

    return NextResponse.json({
      settings: {
        studyStartDate: settings['study_start_date'] || null,
        totalRounds: settings['total_rounds'] || '10',
        announcementChannelId: settings['announcement_channel_id'] || null,
        curationChannelId: settings['curation_channel_id'] || null,
        adminDiscordIds: settings['admin_discord_ids'] || '',
        studyRoleId: settings['study_role_id'] || null,
      },
      currentRound: currentRound || null,
      totalRoundsCreated: allRounds.length,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/settings
 * Update study settings
 * Requirements: 16.11
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check admin access
    const adminCheck = await verifyAdminAccess();
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const db = getDb();
    const now = new Date();

    // Map of frontend keys to database keys
    const keyMap: Record<string, string> = {
      studyStartDate: 'study_start_date',
      totalRounds: 'total_rounds',
      announcementChannelId: 'announcement_channel_id',
      curationChannelId: 'curation_channel_id',
      adminDiscordIds: 'admin_discord_ids',
      studyRoleId: 'study_role_id',
    };

    // Update each setting
    for (const [frontendKey, value] of Object.entries(body)) {
      const dbKey = keyMap[frontendKey];
      if (!dbKey || value === undefined) continue;

      const stringValue = String(value);

      // Check if key exists
      const [existing] = await db
        .select()
        .from(config)
        .where(eq(config.key, dbKey))
        .limit(1);

      if (existing) {
        // Update existing
        await db
          .update(config)
          .set({ value: stringValue, updatedAt: now })
          .where(eq(config.key, dbKey));
      } else {
        // Insert new
        await db.insert(config).values({
          key: dbKey,
          value: stringValue,
          updatedAt: now,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
