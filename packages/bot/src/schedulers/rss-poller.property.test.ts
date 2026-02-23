/**
 * Property-Based Tests for RSS Poller
 * **Feature: blog-study-discord-bot**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { MemberStatus, type Member } from '@blog-study/shared/db';

// Mock the member service
const mockGetAllByStatus = vi.fn();
vi.mock('../services/member.service', () => ({
  getMemberService: () => ({
    getAllByStatus: mockGetAllByStatus,
  }),
}));

// Mock the RSS service
vi.mock('../services/rss.service', () => ({
  getRssService: () => ({
    fetchFeed: vi.fn().mockResolvedValue([]),
  }),
}));

import { RssPoller } from './rss-poller';

/**
 * Generate a mock member with specified status
 */
function generateMember(
  id: string,
  discordId: string,
  status: string,
  hasRssUrl: boolean
): Member {
  return {
    id,
    discordId,
    discordUsername: `user_${discordId}`,
    name: `Name ${discordId}`,
    part: 'frontend',
    blogUrl: `https://blog.example.com/${discordId}`,
    rssUrl: hasRssUrl ? `https://blog.example.com/${discordId}/rss` : null,
    profileImageUrl: null,
    bio: null,
    interests: null,
    resolution: null,
    onboardingCompleted: false,
    status,
    dormantStartRound: null,
    dormantUsed: false,
    joinedAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('RSS Poller Property Tests', () => {
  let poller: RssPoller;

  beforeEach(() => {
    vi.clearAllMocks();
    poller = new RssPoller();
  });

  afterEach(() => {
    poller.stop();
  });

  /**
   * **Feature: blog-study-discord-bot, Property 15: Active Member RSS Polling**
   * *For any* RSS polling operation, only Members with `active` status
   * SHALL have their feeds processed.
   * **Validates: Requirements 6.2**
   */
  describe('Property 15: Active Member RSS Polling', () => {
    it('should only return active members with RSS URLs for polling', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a list of members with various statuses
          fc.array(
            fc.record({
              id: fc.uuid(),
              discordId: fc.stringMatching(/^\d{17,19}$/),
              status: fc.constantFrom(
                MemberStatus.ACTIVE,
                MemberStatus.DORMANT,
                MemberStatus.WITHDRAWN
              ),
              hasRssUrl: fc.boolean(),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (memberSpecs) => {
            // Create mock members
            const allMembers = memberSpecs.map((spec, index) =>
              generateMember(
                spec.id,
                spec.discordId + index, // Ensure unique
                spec.status,
                spec.hasRssUrl
              )
            );

            // Filter to only active members (what the service should return)
            const activeMembers = allMembers.filter(
              m => m.status === MemberStatus.ACTIVE
            );

            // Mock the service to return only active members
            mockGetAllByStatus.mockResolvedValue(activeMembers);

            // Get members to poll
            const membersToPolll = await poller.getMembersToPolll();

            // Verify: all returned members should be active AND have RSS URL
            for (const member of membersToPolll) {
              expect(member.status).toBe(MemberStatus.ACTIVE);
              expect(member.rssUrl).not.toBeNull();
            }

            // Verify: the service was called with ACTIVE status
            expect(mockGetAllByStatus).toHaveBeenCalledWith(MemberStatus.ACTIVE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter out members without RSS URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              discordId: fc.stringMatching(/^\d{17,19}$/),
              hasRssUrl: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (memberSpecs) => {
            // Create all active members, some with and some without RSS URLs
            const activeMembers = memberSpecs.map((spec, index) =>
              generateMember(
                spec.id,
                spec.discordId + index,
                MemberStatus.ACTIVE,
                spec.hasRssUrl
              )
            );

            mockGetAllByStatus.mockResolvedValue(activeMembers);

            const membersToPolll = await poller.getMembersToPolll();

            // All returned members should have RSS URLs
            for (const member of membersToPolll) {
              expect(member.rssUrl).not.toBeNull();
              expect(member.rssUrl).toBeDefined();
            }

            // Count should match members with RSS URLs
            const expectedCount = activeMembers.filter(m => m.rssUrl).length;
            expect(membersToPolll.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not poll dormant or withdrawn members', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              discordId: fc.stringMatching(/^\d{17,19}$/),
              status: fc.constantFrom(MemberStatus.DORMANT, MemberStatus.WITHDRAWN),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (memberSpecs) => {
            // Create non-active members
            const nonActiveMembers = memberSpecs.map((spec, index) =>
              generateMember(
                spec.id,
                spec.discordId + index,
                spec.status,
                true // All have RSS URLs
              )
            );

            // Service returns empty for active (since we're testing non-active)
            mockGetAllByStatus.mockResolvedValue([]);

            const membersToPolll = await poller.getMembersToPolll();

            // Should return empty since we only query for active
            expect(membersToPolll.length).toBe(0);
            expect(mockGetAllByStatus).toHaveBeenCalledWith(MemberStatus.ACTIVE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
