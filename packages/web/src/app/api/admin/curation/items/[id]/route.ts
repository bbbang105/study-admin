import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { curationItems } from '@blog-study/shared/db';
import { withAdminAuth } from '@/lib/admin';

/**
 * DELETE /api/admin/curation/items/[id]
 * 큐레이션 아이템 삭제
 */
export const DELETE = withAdminAuth(async (request: NextRequest, _adminAuth) => {
  try {
    const id = new URL(request.url).pathname.split('/').pop();
    if (!id) {
      return NextResponse.json(
        { error: '아이템 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const database = getDb();

    const [deleted] = await database
      .delete(curationItems)
      .where(eq(curationItems.id, id))
      .returning({ id: curationItems.id });

    if (!deleted) {
      return NextResponse.json(
        { error: '아이템을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deletedId: deleted.id });
  } catch (error) {
    console.error('Error deleting curation item:', error);
    return NextResponse.json(
      { error: '아이템 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
});
