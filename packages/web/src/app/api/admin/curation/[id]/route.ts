import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { curationSources, curationItems, CurationCategory } from '@blog-study/shared/db';
import { withAdminAuth } from '@/lib/admin';

/**
 * GET /api/admin/curation/[id]
 * Get a single curation source
 */
export const GET = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const id = new URL(request.url).pathname.split('/').pop();
    if (!id) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    const database = getDb();

    const [source] = await database
      .select()
      .from(curationSources)
      .where(eq(curationSources.id, id))
      .limit(1);

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    return NextResponse.json(source);
  } catch (error) {
    console.error('Error fetching curation source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch curation source' },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/curation/[id]
 * Update a curation source (toggle active status, update name, etc.)
 */
export const PATCH = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const id = new URL(request.url).pathname.split('/').pop();
    if (!id) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    const body = await request.json();

    // Validate inputs before DB access
    const validCategories = Object.values(CurationCategory);
    if (body.category !== undefined && !validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `유효하지 않은 카테고리입니다. (${validCategories.join(', ')})` },
        { status: 400 }
      );
    }
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim() === '')) {
      return NextResponse.json(
        { error: '이름은 빈 문자열일 수 없습니다.' },
        { status: 400 }
      );
    }
    if (body.url !== undefined) {
      try {
        new URL(body.url);
      } catch {
        return NextResponse.json(
          { error: '유효하지 않은 URL입니다.' },
          { status: 400 }
        );
      }
    }
    if (body.tags !== undefined && !Array.isArray(body.tags)) {
      return NextResponse.json(
        { error: 'tags는 배열이어야 합니다.' },
        { status: 400 }
      );
    }

    const database = getDb();

    // Check if source exists
    const [existing] = await database
      .select()
      .from(curationSources)
      .where(eq(curationSources.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Build update object
    const updateData: Partial<typeof curationSources.$inferInsert> = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.url !== undefined) {
      updateData.url = body.url;
    }
    if (body.category !== undefined) {
      updateData.category = body.category;
    }
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }
    if (body.tags !== undefined) {
      updateData.tags = body.tags;
    }
    if (body.rssUrl !== undefined) {
      updateData.rssUrl = body.rssUrl;
    }

    // Update source
    const [updated] = await database
      .update(curationSources)
      .set(updateData)
      .where(eq(curationSources.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating curation source:', error);
    return NextResponse.json(
      { error: 'Failed to update curation source' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/curation/[id]
 * Delete a curation source and all its items
 * Requirements: 15.5
 */
export const DELETE = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const id = new URL(request.url).pathname.split('/').pop();
    if (!id) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    const database = getDb();

    // Check if source exists
    const [existing] = await database
      .select()
      .from(curationSources)
      .where(eq(curationSources.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Delete all items from this source first
    await database
      .delete(curationItems)
      .where(eq(curationItems.sourceId, id));

    // Delete the source
    await database
      .delete(curationSources)
      .where(eq(curationSources.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting curation source:', error);
    return NextResponse.json(
      { error: 'Failed to delete curation source' },
      { status: 500 }
    );
  }
});
