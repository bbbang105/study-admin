import { createClient } from '@/lib/supabase/server';
import { Errors, successResponse } from '@/lib/api-error';
import { isSafeUrl } from '@/lib/rss-detect';

/**
 * HTML 엔티티 디코딩 (&#xHHHH; / &#DDD; / &amp; 등)
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'");
}

/**
 * POST /api/posts/preview
 * URL에서 OG 태그 추출 (미리보기용, 등록 안 함)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Errors.unauthorized().toResponse();

    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return Errors.badRequest('URL은 필수입니다.').toResponse();
    }
    if (!isSafeUrl(url)) {
      return Errors.badRequest('유효하지 않은 URL입니다.').toResponse();
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BlogStudyBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return successResponse({ title: null, description: null, thumbnailUrl: null, publishedAt: null });
    }

    const html = await response.text();

    // title: og:title > <title>
    const ogTitleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = ogTitleMatch?.[1] || titleMatch?.[1] || null;
    if (title) title = decodeHtmlEntities(title).trim();

    // publishedAt
    const pubMatch =
      html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i);
    const publishedAt = pubMatch?.[1] || null;

    // og:image
    const ogImageMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    let thumbnailUrl = ogImageMatch?.[1] || null;
    if (thumbnailUrl) thumbnailUrl = decodeHtmlEntities(thumbnailUrl);
    if (thumbnailUrl && !isSafeUrl(thumbnailUrl)) thumbnailUrl = null;

    // og:image 없으면 JSON-LD → 본문 첫 이미지 순서로 fallback
    if (!thumbnailUrl) {
      // JSON-LD Schema.org image (Medium 등 JS 렌더링 플랫폼)
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch?.[1] && jsonLdMatch[1].length < 100_000) {
        try {
          const ld = JSON.parse(jsonLdMatch[1]);
          const ldImage = ld.image?.url || ld.image?.contentUrl || (typeof ld.image === 'string' ? ld.image : null);
          if (ldImage && isSafeUrl(ldImage)) thumbnailUrl = ldImage;
        } catch { /* invalid JSON-LD */ }
      }
    }
    if (!thumbnailUrl) {
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      const fallback = imgMatch?.[1] || null;
      if (fallback && isSafeUrl(fallback)) thumbnailUrl = fallback;
    }

    // og:description > meta description
    const ogDescMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
    const metaDescMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    let description = ogDescMatch?.[1] || metaDescMatch?.[1] || null;
    if (description) description = decodeHtmlEntities(description).trim().slice(0, 300);

    return successResponse({ title, description, thumbnailUrl, publishedAt });
  } catch {
    return Errors.internalError().toResponse();
  }
}
