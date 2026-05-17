/**
 * 멤버 블로그(member_blogs) 공용 헬퍼
 * 프로필 수정 / 온보딩 / 관리자 멤버 생성·수정에서 공통 사용
 */

import { after } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db as sharedDb } from '@blog-study/shared';
import { db } from '@/lib/db';
import { detectRssUrl, isSafeUrl } from '@/lib/rss-detect';

const { memberBlogs, MAX_BLOGS_PER_MEMBER } = sharedDb;

export const MAX_BLOGS = MAX_BLOGS_PER_MEMBER;

const MAX_URL_LEN = 500;
const MAX_LABEL_LEN = 100;

export interface BlogInput {
  id?: string;
  label?: string | null;
  blogUrl?: string;
  rssConsent?: boolean;
}

export interface NormalizedBlog {
  id?: string;
  label: string | null;
  blogUrl: string;
  rssConsent: boolean;
}

export type ValidateResult =
  | { ok: true; value: NormalizedBlog[] }
  | { ok: false; message: string };

/**
 * 클라이언트가 보낸 blogs 배열 검증 + 정규화
 * @param required 최소 1개 필요 여부 (온보딩/생성=true)
 */
export function validateBlogInputs(raw: unknown, required = true): ValidateResult {
  if (!Array.isArray(raw)) {
    return { ok: false, message: '블로그 목록 형식이 올바르지 않습니다.' };
  }

  if (raw.length === 0) {
    if (required) return { ok: false, message: '블로그를 1개 이상 등록해주세요.' };
    return { ok: true, value: [] };
  }

  if (raw.length > MAX_BLOGS) {
    return { ok: false, message: `블로그는 최대 ${MAX_BLOGS}개까지 등록할 수 있습니다.` };
  }

  const normalized: NormalizedBlog[] = [];
  const seenUrls = new Set<string>();

  for (const item of raw as BlogInput[]) {
    const blogUrl = typeof item?.blogUrl === 'string' ? item.blogUrl.trim() : '';
    if (!blogUrl) {
      return { ok: false, message: '블로그 URL은 필수입니다.' };
    }
    if (blogUrl.length > MAX_URL_LEN) {
      return { ok: false, message: `블로그 URL은 ${MAX_URL_LEN}자 이내여야 합니다.` };
    }
    if (!isSafeUrl(blogUrl)) {
      return { ok: false, message: `유효하지 않은 블로그 URL입니다: ${blogUrl}` };
    }

    const dedupeKey = blogUrl.toLowerCase();
    if (seenUrls.has(dedupeKey)) {
      return { ok: false, message: '중복된 블로그 URL이 있습니다.' };
    }
    seenUrls.add(dedupeKey);

    let label: string | null = null;
    if (typeof item?.label === 'string') {
      const trimmed = item.label.trim();
      if (trimmed.length > MAX_LABEL_LEN) {
        return { ok: false, message: `블로그 이름은 ${MAX_LABEL_LEN}자 이내여야 합니다.` };
      }
      label = trimmed.length > 0 ? trimmed : null;
    }

    const id = typeof item?.id === 'string' && item.id.length > 0 ? item.id : undefined;
    const rssConsent = item?.rssConsent !== false;

    normalized.push({ id, label, blogUrl, rssConsent });
  }

  return { ok: true, value: normalized };
}

/**
 * 멤버 블로그 조회 (sort_order 순)
 */
export async function fetchMemberBlogs(memberId: string) {
  const rows = await db()
    .select()
    .from(memberBlogs)
    .where(eq(memberBlogs.memberId, memberId))
    .orderBy(asc(memberBlogs.sortOrder));

  return rows.map((b) => ({
    id: b.id,
    label: b.label,
    blogUrl: b.blogUrl,
    rssUrl: b.rssUrl,
    rssConsent: b.rssConsent,
    sortOrder: b.sortOrder,
  }));
}

/**
 * 신규 멤버의 블로그 일괄 생성 (온보딩/관리자 생성)
 * 각 블로그 RSS URL은 after()로 비동기 감지
 */
export async function createMemberBlogs(
  memberId: string,
  blogs: NormalizedBlog[]
): Promise<void> {
  if (blogs.length === 0) return;

  const inserted = await db()
    .insert(memberBlogs)
    .values(
      blogs.map((b, idx) => ({
        memberId,
        label: b.label,
        blogUrl: b.blogUrl,
        rssUrl: null,
        rssConsent: b.rssConsent,
        sortOrder: idx,
      }))
    )
    .returning({ id: memberBlogs.id, blogUrl: memberBlogs.blogUrl });

  scheduleRssDetection(inserted);
}

/**
 * 멤버 블로그 동기화 (프로필/관리자 수정)
 * - id 매칭: label/rssConsent/sortOrder 갱신, blogUrl 변경 시 rssUrl 초기화 + 재감지
 * - id 없음: 신규 insert + 재감지
 * - 입력에 없는 기존 행: 삭제
 */
export async function syncMemberBlogs(
  memberId: string,
  blogs: NormalizedBlog[]
): Promise<void> {
  const database = db();
  const existing = await database
    .select()
    .from(memberBlogs)
    .where(eq(memberBlogs.memberId, memberId));

  const existingById = new Map(existing.map((b) => [b.id, b]));
  const keptIds = new Set<string>();
  const toRedetect: { id: string; blogUrl: string }[] = [];

  for (let idx = 0; idx < blogs.length; idx++) {
    const input = blogs[idx]!;
    const current = input.id ? existingById.get(input.id) : undefined;

    if (current) {
      keptIds.add(current.id);
      const urlChanged = current.blogUrl !== input.blogUrl;
      await database
        .update(memberBlogs)
        .set({
          label: input.label,
          blogUrl: input.blogUrl,
          rssConsent: input.rssConsent,
          sortOrder: idx,
          ...(urlChanged ? { rssUrl: null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(memberBlogs.id, current.id));

      if (urlChanged) toRedetect.push({ id: current.id, blogUrl: input.blogUrl });
    } else {
      const [created] = await database
        .insert(memberBlogs)
        .values({
          memberId,
          label: input.label,
          blogUrl: input.blogUrl,
          rssUrl: null,
          rssConsent: input.rssConsent,
          sortOrder: idx,
        })
        .returning({ id: memberBlogs.id });
      if (created) {
        keptIds.add(created.id);
        toRedetect.push({ id: created.id, blogUrl: input.blogUrl });
      }
    }
  }

  // 입력에서 빠진 기존 블로그 삭제
  const removedIds = existing.filter((b) => !keptIds.has(b.id)).map((b) => b.id);
  if (removedIds.length > 0) {
    await database
      .delete(memberBlogs)
      .where(and(eq(memberBlogs.memberId, memberId), inArray(memberBlogs.id, removedIds)));
  }

  scheduleRssDetection(toRedetect);
}

/**
 * RSS URL 비동기 감지 (fire-and-forget, Vercel after())
 */
function scheduleRssDetection(targets: { id: string; blogUrl: string }[]): void {
  if (targets.length === 0) return;

  after(async () => {
    for (const t of targets) {
      try {
        const rssUrl = await detectRssUrl(t.blogUrl);
        if (rssUrl) {
          await db()
            .update(memberBlogs)
            .set({ rssUrl, updatedAt: new Date() })
            .where(eq(memberBlogs.id, t.id));
        }
      } catch (err) {
        console.error('[member-blogs] RSS 재감지 실패:', t.blogUrl, err);
      }
    }
  });
}
