import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { curationSources, curationItems } from '@blog-study/shared/db';
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
