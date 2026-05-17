/**
 * RSS Poller Scheduler
 * 5분마다 active/OB 멤버의 모든 블로그 RSS 폴링
 * Requirements: 6.1, 6.2
 */

import { getMemberBlogService, type PollableBlog } from '../services/member-blog.service';
import { getPostService } from '../services/post.service';
import { getRssService, type PollResult, type RssFeedItem } from '../services/rss.service';
import { type Member } from '@blog-study/shared/db';
import logger from '../lib/logger';

/**
 * Result of a polling cycle
 */
export interface PollingCycleResult {
  timestamp: Date;
  membersPolled: number;
  totalNewItems: number;
  results: PollResult[];
  errors: string[];
}

/**
 * Callback for when new posts are found
 */
export type OnNewPostCallback = (
  member: Member,
  items: RssFeedItem[]
) => Promise<void>;

/**
 * RSS Poller class for scheduling RSS feed polling
 */
export class RssPoller {
  private isRunning = false;
  private onNewPost: OnNewPostCallback | null = null;

  /**
   * Set callback for when new posts are found
   */
  setOnNewPostCallback(callback: OnNewPostCallback): void {
    this.onNewPost = callback;
  }

  /**
   * Check if the poller is currently running
   */
  isPolling(): boolean {
    return this.isRunning;
  }

  /**
   * Get blogs that should be polled
   * Active + OB members' blogs with RSS consent and an RSS URL
   */
  async getBlogsToPoll(): Promise<PollableBlog[]> {
    const memberBlogService = getMemberBlogService();
    return memberBlogService.getPollableBlogs();
  }

  /**
   * Poll a single blog's RSS feed
   */
  async pollBlog({ member, blog }: PollableBlog): Promise<PollResult> {
    if (!blog.rssUrl) {
      return {
        memberId: member.id,
        blogId: blog.id,
        success: false,
        newItems: [],
        error: 'No RSS URL configured',
      };
    }

    try {
      const rssService = getRssService();
      const postService = getPostService();
      const items = await rssService.fetchFeed(blog.rssUrl);

      if (items.length === 0) {
        return { memberId: member.id, blogId: blog.id, success: true, newItems: [] };
      }

      // Batch duplicate check: 1 IN query instead of N individual SELECTs
      // postService.create() has its own getByUrl guard as a write-time safety net
      const feedUrls = items.map(item => item.link).filter(Boolean);
      const existingUrls = await postService.getExistingUrls(feedUrls);
      const newItems = items.filter(item => !existingUrls.has(item.link));

      return {
        memberId: member.id,
        blogId: blog.id,
        success: true,
        newItems,
      };
    } catch (error) {
      // Requirements: 6.5 - Log error and continue processing other feeds
      logger.error({
        member: member.discordUsername,
        blogId: blog.id,
        rssUrl: blog.rssUrl,
        error,
      }, '📡 [RSS] 블로그 피드 폴링 에러');

      return {
        memberId: member.id,
        blogId: blog.id,
        success: false,
        newItems: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run a polling cycle for all active/OB members' blogs
   * Requirements: 6.1, 6.2
   */
  async poll(): Promise<PollingCycleResult> {
    if (this.isRunning) {
      logger.warn('📡 [RSS] 폴링이 이미 진행 중, 스킵');
      return {
        timestamp: new Date(),
        membersPolled: 0,
        totalNewItems: 0,
        results: [],
        errors: ['Polling already in progress'],
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    const results: PollResult[] = [];
    const errors: string[] = [];

    try {
      const blogs = await this.getBlogsToPoll();
      logger.info({ blogCount: blogs.length }, '📡 [RSS] 블로그 폴링 시작');

      for (const pollable of blogs) {
        const { member } = pollable;
        const result = await this.pollBlog(pollable);
        results.push(result);

        if (!result.success && result.error) {
          errors.push(`${member.discordUsername} (${pollable.blog.rssUrl}): ${result.error}`);
        }

        // Call the callback if there are new items
        if (result.success && result.newItems.length > 0 && this.onNewPost) {
          try {
            await this.onNewPost(member, result.newItems);
          } catch (callbackError) {
            logger.error({
              member: member.discordUsername,
              error: callbackError,
            }, '📡 [RSS] 콜백 에러');
            const errorMsg = callbackError instanceof Error
              ? callbackError.message
              : String(callbackError);
            errors.push(`Callback error for ${member.discordUsername}: ${errorMsg}`);
          }
        }
      }

      const totalNewItems = results.reduce((sum, r) => sum + r.newItems.length, 0);
      // 한 멤버가 블로그를 여러 개 가질 수 있으므로 distinct 멤버 수로 집계
      const membersPolled = new Set(blogs.map((b) => b.member.id)).size;
      logger.info({ totalNewItems }, '📡 [RSS] 폴링 완료');

      return {
        timestamp: startTime,
        membersPolled,
        totalNewItems,
        results,
        errors,
      };
    } finally {
      this.isRunning = false;
    }
  }
}

// Singleton instance
let rssPollerInstance: RssPoller | null = null;

/**
 * Get the RssPoller singleton instance
 */
export function getRssPoller(): RssPoller {
  if (!rssPollerInstance) {
    rssPollerInstance = new RssPoller();
  }
  return rssPollerInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetRssPoller(): void {
  rssPollerInstance = null;
}
