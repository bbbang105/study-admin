/**
 * Member Blog Service
 * 멤버당 여러 블로그(member_blogs) 관리 서비스
 */

import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { getDb, type Member, type MemberBlog, memberBlogs, members, MemberStatus, } from '@blog-study/shared/db';

/**
 * RSS 폴링 대상 (멤버 + 블로그 페어)
 */
export interface PollableBlog {
  member: Member;
  blog: MemberBlog;
}

/**
 * Member blog service
 */
export class MemberBlogService {
  private db = getDb();

  /**
   * RSS 폴링 대상 블로그 조회
   * - 멤버 상태: active 또는 ob
   * - 블로그: rss_consent = true 이고 rss_url 존재
   */
  async getPollableBlogs(): Promise<PollableBlog[]> {
    const rows = await this.db
      .select({ member: members, blog: memberBlogs })
      .from(memberBlogs)
      .innerJoin(members, eq(memberBlogs.memberId, members.id))
      .where(
        and(
          inArray(members.status, [MemberStatus.ACTIVE, MemberStatus.OB]),
          eq(memberBlogs.rssConsent, true),
          isNotNull(memberBlogs.rssUrl)
        )
      )
      .orderBy(asc(memberBlogs.memberId), asc(memberBlogs.sortOrder));

    return rows.map((r) => ({ member: r.member, blog: r.blog }));
  }

  /**
   * 멤버의 모든 블로그 조회 (sort_order 순)
   */
  async getByMember(memberId: string): Promise<MemberBlog[]> {
    return this.db
      .select()
      .from(memberBlogs)
      .where(eq(memberBlogs.memberId, memberId))
      .orderBy(asc(memberBlogs.sortOrder));
  }
}

// Singleton instance
let memberBlogServiceInstance: MemberBlogService | null = null;

/**
 * Get the MemberBlogService singleton instance
 */
export function getMemberBlogService(): MemberBlogService {
  if (!memberBlogServiceInstance) {
    memberBlogServiceInstance = new MemberBlogService();
  }
  return memberBlogServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetMemberBlogService(): void {
  memberBlogServiceInstance = null;
}
