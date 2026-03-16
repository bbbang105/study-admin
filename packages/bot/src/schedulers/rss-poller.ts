/**
 * RSS Poller Scheduler
 * 5분마다 모든 active 멤버의 RSS 폴링
 * Requirements: 6.1, 6.2
 */

import { getMemberService } from '../services/member.service';
import { getRssService, type PollResult, type RssFeedItem } from '../services/rss.service';
import { type Member, MemberStatus } from '@blog-study/shared/db';
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
   * Get members that should be polled
   * Requirements: 6.2 - Only active members should be polled
   */
  async getMembersToPoll(): Promise<Member[]> {
    const memberService = getMemberService();
    const activeMembers = await memberService.getAllByStatus(MemberStatus.ACTIVE);
    
    // Filter to only members with RSS URLs and RSS consent
    return activeMembers.filter(member => member.rssUrl && member.rssConsent !== false);
  }

  /**
   * Poll a single member's RSS feed
   */
  async pollMember(member: Member): Promise<PollResult> {
    if (!member.rssUrl) {
      return {
        memberId: member.id,
        success: false,
        newItems: [],
        error: 'No RSS URL configured',
      };
    }

    try {
      const rssService = getRssService();
      const items = await rssService.fetchFeed(member.rssUrl);
      
      return {
        memberId: member.id,
        success: true,
        newItems: items,
      };
    } catch (error) {
      // Requirements: 6.5 - Log error and continue processing other feeds
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        member: member.discordUsername,
        error: errorMessage,
      }, '📡 [RSS] 멤버 피드 폴링 에러');
      
      return {
        memberId: member.id,
        success: false,
        newItems: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Run a polling cycle for all active members
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
      const members = await this.getMembersToPoll();
      logger.info({ memberCount: members.length }, '📡 [RSS] 활성 멤버 폴링 시작');

      for (const member of members) {
        const result = await this.pollMember(member);
        results.push(result);

        if (!result.success && result.error) {
          errors.push(`${member.discordUsername}: ${result.error}`);
        }

        // Call the callback if there are new items
        if (result.success && result.newItems.length > 0 && this.onNewPost) {
          try {
            await this.onNewPost(member, result.newItems);
          } catch (callbackError) {
            const errorMsg = callbackError instanceof Error
              ? callbackError.message
              : String(callbackError);
            logger.error({
              member: member.discordUsername,
              error: errorMsg,
            }, '📡 [RSS] 콜백 에러');
            errors.push(`Callback error for ${member.discordUsername}: ${errorMsg}`);
          }
        }
      }

      const totalNewItems = results.reduce((sum, r) => sum + r.newItems.length, 0);
      logger.info({ totalNewItems }, '📡 [RSS] 폴링 완료');

      return {
        timestamp: startTime,
        membersPolled: members.length,
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
