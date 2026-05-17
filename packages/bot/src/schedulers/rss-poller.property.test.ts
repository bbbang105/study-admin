/**
 * Property-Based Tests for RSS Poller
 * **Feature: blog-study-discord-bot**
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { type Member, type MemberBlog, MemberStatus } from '@blog-study/shared/db';
import { RssPoller } from './rss-poller';

// Mock the member-blog service (RSS 폴링 대상 조회를 담당)
const mockGetPollableBlogs = vi.fn();
vi.mock('../services/member-blog.service', () => ({
  getMemberBlogService: () => ({
    getPollableBlogs: mockGetPollableBlogs,
  }),
}));

// Mock the RSS service
vi.mock('../services/rss.service', () => ({
  getRssService: () => ({
    fetchFeed: vi.fn().mockResolvedValue([]),
  }),
}));

/**
 * Generate a mock member with specified status
 */
function generateMember(id: string, discordId: string, status: string): Member {
  return {
    id,
    discordId,
    discordUsername: `user_${discordId}`,
    name: `Name ${discordId}`,
    nickname: `Nick ${discordId}`,
    part: 'frontend',
    profileImageUrl: null,
    bio: null,
    interests: null,
    resolution: null,
    onboardingCompleted: false,
    githubUrl: null,
    linkedinUrl: null,
    instagramUrl: null,
    status,
    dormantStartRound: null,
    dormantUsed: false,
    joinedAt: new Date(),
    updatedAt: new Date(),
  } as Member;
}

/**
 * Generate a mock member blog
 */
function generateBlog(
  id: string,
  memberId: string,
  hasRssUrl: boolean,
  rssConsent: boolean
): MemberBlog {
  return {
    id,
    memberId,
    label: null,
    blogUrl: `https://blog.example.com/${memberId}`,
    rssUrl: hasRssUrl ? `https://blog.example.com/${memberId}/rss` : null,
    rssConsent,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as MemberBlog;
}

/**
 * The (member, blog) pollable filter as enforced by MemberBlogService.getPollableBlogs():
 * member status ∈ {active, ob} AND blog.rssConsent === true AND blog.rssUrl !== null
 */
function pollableFilter(member: Member, blog: MemberBlog): boolean {
  return (
    (member.status === MemberStatus.ACTIVE || member.status === MemberStatus.OB) &&
    blog.rssConsent === true &&
    blog.rssUrl !== null
  );
}

describe('RSS Poller Property Tests', () => {
  let poller: RssPoller;

  beforeEach(() => {
    vi.clearAllMocks();
    poller = new RssPoller();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: blog-study-discord-bot, Property 15: Active Member RSS Polling**
   * *For any* RSS polling operation, only blogs belonging to `active`/`ob`
   * Members, with RSS consent and an RSS URL, SHALL have their feeds processed.
   * **Validates: Requirements 6.2**
   */
  describe('Property 15: Active Member RSS Polling', () => {
    it('should only return active/OB members blogs with RSS URL + consent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              discordId: fc.stringMatching(/^\d{17,19}$/),
              status: fc.constantFrom(
                MemberStatus.ACTIVE,
                MemberStatus.OB,
                MemberStatus.DORMANT,
                MemberStatus.WITHDRAWN
              ),
              hasRssUrl: fc.boolean(),
              rssConsent: fc.boolean(),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (specs) => {
            const pairs = specs.map((spec, index) => {
              const member = generateMember(spec.id, spec.discordId + index, spec.status);
              const blog = generateBlog(
                `blog-${index}`,
                member.id,
                spec.hasRssUrl,
                spec.rssConsent
              );
              return { member, blog };
            });

            // Service applies the SQL-level filter
            const pollable = pairs.filter((p) => pollableFilter(p.member, p.blog));
            mockGetPollableBlogs.mockResolvedValue(pollable);

            const blogsToPoll = await poller.getBlogsToPoll();

            for (const { member, blog } of blogsToPoll) {
              expect([MemberStatus.ACTIVE, MemberStatus.OB]).toContain(member.status);
              expect(blog.rssConsent).toBe(true);
              expect(blog.rssUrl).not.toBeNull();
            }
            expect(blogsToPoll.length).toBe(pollable.length);
            expect(mockGetPollableBlogs).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter out blogs without RSS URLs or without consent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              discordId: fc.stringMatching(/^\d{17,19}$/),
              hasRssUrl: fc.boolean(),
              rssConsent: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (specs) => {
            const pairs = specs.map((spec, index) => {
              const member = generateMember(
                spec.id,
                spec.discordId + index,
                MemberStatus.ACTIVE
              );
              const blog = generateBlog(
                `blog-${index}`,
                member.id,
                spec.hasRssUrl,
                spec.rssConsent
              );
              return { member, blog };
            });

            const pollable = pairs.filter((p) => pollableFilter(p.member, p.blog));
            mockGetPollableBlogs.mockResolvedValue(pollable);

            const blogsToPoll = await poller.getBlogsToPoll();

            for (const { blog } of blogsToPoll) {
              expect(blog.rssUrl).not.toBeNull();
              expect(blog.rssUrl).toBeDefined();
              expect(blog.rssConsent).toBe(true);
            }
            const expectedCount = pairs.filter(
              (p) => p.blog.rssUrl && p.blog.rssConsent
            ).length;
            expect(blogsToPoll.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not poll dormant or withdrawn members blogs', async () => {
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
          async (specs) => {
            const pairs = specs.map((spec, index) => {
              const member = generateMember(spec.id, spec.discordId + index, spec.status);
              const blog = generateBlog(`blog-${index}`, member.id, true, true);
              return { member, blog };
            });

            // Service excludes non-active/OB members → empty
            const pollable = pairs.filter((p) => pollableFilter(p.member, p.blog));
            mockGetPollableBlogs.mockResolvedValue(pollable);

            const blogsToPoll = await poller.getBlogsToPoll();

            expect(blogsToPoll.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
