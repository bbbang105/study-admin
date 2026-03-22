import { createClient } from '@/lib/supabase/server';
import { uploadToR2 } from '@/lib/r2';
import { errorResponse, Errors, successResponse } from '@/lib/api-error';
import { randomUUID } from 'crypto';

/** Allowed image MIME types */
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

/** Max image upload size: 5MB */
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/* ── Rate limiting (in-memory) ── */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  // Cleanup expired entries to prevent memory leak
  if (rateLimitMap.size > 1000) {
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/**
 * POST /api/board/image
 *
 * Accepts multipart/form-data with:
 *   image: image file (jpeg, png, gif, webp)
 *
 * Returns: { success: true, data: { url: string } }
 */
export async function POST(request: Request) {
  try {
    // Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Errors.unauthorized().toResponse();
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      return Errors.badRequest('업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.').toResponse();
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Errors.badRequest('잘못된 요청입니다.').toResponse();
    }

    const file = formData.get('image');
    if (!file || !(file instanceof File)) {
      return Errors.badRequest('이미지 파일이 필요합니다.').toResponse();
    }

    // Validate MIME type
    const mimeType = file.type || 'application/octet-stream';
    const isAllowed = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType);
    if (!isAllowed) {
      return Errors.badRequest(
        `지원하지 않는 파일 형식입니다: ${mimeType}. 허용: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      ).toResponse();
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return Errors.badRequest(
        `파일 크기가 너무 큽니다. 최대 ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB까지 업로드 가능합니다.`
      ).toResponse();
    }

    // Build a safe R2 key: board-images/{userId}/{uuid}.{ext}
    const ext = MIME_TO_EXT[mimeType] ?? 'jpg';
    const key = `board-images/${user.id}/${randomUUID()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadToR2(key, buffer, mimeType);

    return successResponse({ url });
  } catch (error) {
    console.error('[POST /api/board/image]', error);
    return errorResponse(error);
  }
}
