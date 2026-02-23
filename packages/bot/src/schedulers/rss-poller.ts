/**
 * RSS Poller Scheduler
 * 5분마다 모든 active 멤버의 RSS 폴링
 * Requirements: 6.1, 6.2
 */

import cron from 'node-cron';
import { getMemberService } from '../services/member.service';
import { getRssService, type RssFeedItem, type PollResult } from '../services/rss.service';
import { MemberStatus, type Member } from '@blog-study/shared/db';

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
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private onNewPost: OnNewPostCallback | null = null;

  /**
   * Set callback for when new posts are found
   */
  setOnNewPostCallback(callback: OnNewPostCallback): void {
    this.onNewPost = callback;
  }

  /**
   * Start the RSS polling scheduler
   * Runs every 5 minutes
   * Requirements: 6.1
   */
  start(): void {
    if (this.cronJob) {
      console.log('[RssPoller] Already running');
      return;
    }

    // Run every 5 minutes: */5 * * * *
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      await this.poll();
    });

    console.log('[RssPoller] Started - polling every 5 minutes');
  }

  /**
   * Stop the RSS polling scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[RssPoller] Stopped');
    }
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
    
    // Filter to only members with RSS URLs
    return activeMembers.filter(member => member.rssUrl);
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
      console.error(`[RssPoller] Error polling ${member.discordUsername}: ${errorMessage}`);
      
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
      console.log('[RssPoller] Polling already in progress, skipping');
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
      console.log(`[RssPoller] Polling ${members.length} active members`);

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
            console.error(`[RssPoller] Callback error for ${member.discordUsername}: ${errorMsg}`);
            errors.push(`Callback error for ${member.discordUsername}: ${errorMsg}`);
          }
        }
      }

      const totalNewItems = results.reduce((sum, r) => sum + r.newItems.length, 0);
      console.log(`[RssPoller] Completed - ${totalNewItems} new items found`);

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
  if (rssPollerInstance) {
    rssPollerInstance.stop();
  }
  rssPollerInstance = null;
}
