/**
 * Property-Based Tests for NotificationService
 * Tests correctness properties for notification message formatting
 * 
 * These tests verify the business logic of notification operations using
 * pure functions extracted from the service.
 * 
 * **Feature: blog-study-discord-bot, Property 20: Notification Message Format**
 * **Validates: Requirements 7.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Post, Member, Round, AttendanceStatusType } from '@blog-study/shared/db';
import { AttendanceStatus } from '@blog-study/shared/db';
import {
  buildPostNotificationEmbed,
  buildPostNotificationMessage,
  buildRoundReportEmbed,
  buildRoundReportMessage,
  calculateRoundReportData,
  type PostNotificationInput,
  type AttendanceSummary,
} from './notification.service';

// ============================================
// Arbitraries for generating test data
// ============================================

/**
 * Generate valid UUIDs
 */
const uuidArb = fc.uuid();

/**
 * Generate valid Discord IDs (snowflake format - 17-19 digit numbers)
 */
const discordIdArb = fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), {
  minLength: 17,
  maxLength: 19,
});

/**
 * Generate valid Discord usernames
 */
const discordUsernameArb = fc.string({ minLength: 2, maxLength: 32 }).filter(s => s.trim().length > 0);

/**
 * Generate valid names
 */
const nameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

/**
 * Generate valid parts
 */
const partArb = fc.constantFrom('frontend', 'backend', 'design', 'pm', 'fullstack');

/**
 * Generate valid post titles
 */
const titleArb = fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0);

/**
 * Generate valid post URLs
 */
const postUrlArb = fc.webUrl();

/**
 * Generate valid blog URLs
 */
const blogUrlArb = fc.webUrl();

/**
 * Generate valid descriptions
 */
const descriptionArb = fc.option(fc.string({ maxLength: 1000 }), { nil: null });

/**
 * Generate valid round numbers
 */
const roundNumberArb = fc.integer({ min: 1, max: 52 });

/**
 * Generate a valid Member object
 */
const memberArb: fc.Arbitrary<Member> = fc.record({
  id: uuidArb,
  discordId: discordIdArb,
  discordUsername: discordUsernameArb,
  name: nameArb,
  part: partArb,
  blogUrl: blogUrlArb,
  rssUrl: fc.option(fc.webUrl(), { nil: null }),
  profileImageUrl: fc.option(fc.webUrl(), { nil: null }),
  bio: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  interests: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }), { nil: null }),
  resolution: fc.option(fc.string({ maxLength: 300 }), { nil: null }),
  onboardingCompleted: fc.boolean(),
  status: fc.constantFrom('active', 'dormant', 'withdrawn'),
  dormantStartRound: fc.option(fc.integer({ min: 1, max: 52 }), { nil: null }),
  dormantUsed: fc.boolean(),
  joinedAt: fc.date(),
  updatedAt: fc.date(),
});

/**
 * Generate a valid Post object
 */
const postArb: fc.Arbitrary<Post> = fc.record({
  id: uuidArb,
  memberId: uuidArb,
  roundId: fc.option(fc.integer({ min: 1, max: 52 }), { nil: null }),
  title: titleArb,
  url: postUrlArb,
  publishedAt: fc.date(),
  description: descriptionArb,
  collectedAt: fc.date(),
});

/**
 * Generate a valid Round object
 */
const roundArb: fc.Arbitrary<Round> = fc.record({
  id: fc.integer({ min: 1, max: 100 }),
  roundNumber: roundNumberArb,
  startDate: fc.date().map(d => d.toISOString().split('T')[0]!),
  endDate: fc.date().map(d => d.toISOString().split('T')[0]!),
  graceEndDate: fc.date().map(d => d.toISOString().split('T')[0]!),
  isCurrent: fc.boolean(),
});

/**
 * Generate a valid PostNotificationInput
 */
const postNotificationInputArb: fc.Arbitrary<PostNotificationInput> = fc.record({
  post: postArb,
  member: memberArb,
  roundNumber: fc.option(roundNumberArb, { nil: null }),
});

/**
 * Generate a valid AttendanceSummary
 */
const attendanceSummaryArb: fc.Arbitrary<AttendanceSummary> = fc.record({
  memberId: uuidArb,
  discordId: discordIdArb,
  discordUsername: discordUsernameArb,
  name: nameArb,
  status: fc.constantFrom(
    AttendanceStatus.SUBMITTED,
    AttendanceStatus.LATE,
    AttendanceStatus.ABSENT,
    AttendanceStatus.PENDING
  ) as fc.Arbitrary<AttendanceStatusType>,
  postCount: fc.integer({ min: 0, max: 10 }),
});

// ============================================
// Property Tests
// ============================================

describe('NotificationService Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 20: Notification Message Format**
   * *For any* post notification, the message SHALL contain: post title, author Discord mention,
   * post URL, and round number.
   * **Validates: Requirements 7.2**
   */
  describe('Property 20: Notification Message Format', () => {
    it('should include post title in the embed', () => {
      fc.assert(
        fc.property(postNotificationInputArb, (input) => {
          const embed = buildPostNotificationEmbed(input);
          const embedData = embed.toJSON();
          
          // Title should contain the post title
          expect(embedData.title).toContain(input.post.title);
        }),
        { numRuns: 100 }
      );
    });

    it('should include post URL in the embed', () => {
      fc.assert(
        fc.property(postNotificationInputArb, (input) => {
          const embed = buildPostNotificationEmbed(input);
          const embedData = embed.toJSON();
          
          // URL should be set to the post URL
          expect(embedData.url).toBe(input.post.url);
        }),
        { numRuns: 100 }
      );
    });

    it('should include author Discord mention in the message content', () => {
      fc.assert(
        fc.property(postNotificationInputArb, (input) => {
          const message = buildPostNotificationMessage(input);
          
          // Content should include Discord mention format
          expect(message.content).toContain(`<@${input.member.discordId}>`);
        }),
        { numRuns: 100 }
      );
    });

    it('should include author username in the embed', () => {
      fc.assert(
        fc.property(postNotificationInputArb, (input) => {
          const embed = buildPostNotificationEmbed(input);
          const embedData = embed.toJSON();
          
          // Author name should be set
          expect(embedData.author?.name).toBe(input.member.discordUsername);
        }),
        { numRuns: 100 }
      );
    });

    it('should include round number when provided', () => {
      fc.assert(
        fc.property(
          postNotificationInputArb.filter(input => input.roundNumber !== null),
          (input) => {
            const embed = buildPostNotificationEmbed(input);
            const embedData = embed.toJSON();
            
            // Should have a field with round number
            const roundField = embedData.fields?.find(f => f.name.includes('회차'));
            expect(roundField).toBeDefined();
            expect(roundField?.value).toContain(`${input.roundNumber}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include round field when round number is null', () => {
      fc.assert(
        fc.property(
          postNotificationInputArb.map(input => ({ ...input, roundNumber: null })),
          (input) => {
            const embed = buildPostNotificationEmbed(input);
            const embedData = embed.toJSON();
            
            // Should not have a round field
            const roundField = embedData.fields?.find(f => f.name.includes('회차'));
            expect(roundField).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include member name and part in footer', () => {
      fc.assert(
        fc.property(postNotificationInputArb, (input) => {
          const embed = buildPostNotificationEmbed(input);
          const embedData = embed.toJSON();
          
          // Footer should contain member name and part
          expect(embedData.footer?.text).toContain(input.member.name);
          expect(embedData.footer?.text).toContain(input.member.part);
        }),
        { numRuns: 100 }
      );
    });

    it('should include embeds in the message', () => {
      fc.assert(
        fc.property(postNotificationInputArb, (input) => {
          const message = buildPostNotificationMessage(input);

          // Message should have embeds
          expect(message.embeds).toBeDefined();
          expect(message.embeds?.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should truncate long descriptions', () => {
      fc.assert(
        fc.property(
          postNotificationInputArb.map(input => ({
            ...input,
            post: {
              ...input.post,
              description: 'x'.repeat(300), // Long description
            },
          })),
          (input) => {
            const embed = buildPostNotificationEmbed(input);
            const embedData = embed.toJSON();
            
            // Description should be truncated
            if (embedData.description) {
              expect(embedData.description.length).toBeLessThanOrEqual(200);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 27: Round Report Content**
   * *For any* round report, the content SHALL include: round number, submitted members list,
   * late members list, absent members list, and MVP (member with most posts).
   * **Validates: Requirements 10.2, 10.3**
   */
  describe('Property 27: Round Report Content', () => {
    it('should include round number in the report title', () => {
      fc.assert(
        fc.property(
          roundArb,
          fc.array(attendanceSummaryArb, { minLength: 0, maxLength: 10 }),
          (round, summaries) => {
            const reportData = calculateRoundReportData(round, summaries);
            const embed = buildRoundReportEmbed(reportData);
            const embedData = embed.toJSON();
            
            // Title should contain round number
            expect(embedData.title).toContain(`${round.roundNumber}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly categorize members by attendance status', () => {
      fc.assert(
        fc.property(
          roundArb,
          fc.array(attendanceSummaryArb, { minLength: 1, maxLength: 10 }),
          (round, summaries) => {
            const reportData = calculateRoundReportData(round, summaries);
            
            // Count members in each category
            const expectedSubmitted = summaries.filter(s => s.status === AttendanceStatus.SUBMITTED).length;
            const expectedLate = summaries.filter(s => s.status === AttendanceStatus.LATE).length;
            const expectedAbsent = summaries.filter(s => s.status === AttendanceStatus.ABSENT).length;
            
            expect(reportData.submitted.length).toBe(expectedSubmitted);
            expect(reportData.lateRate).toBeCloseTo(expectedLate / summaries.length, 5);
            expect(reportData.absentRate).toBeCloseTo(expectedAbsent / summaries.length, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct statistics', () => {
      fc.assert(
        fc.property(
          roundArb,
          fc.array(attendanceSummaryArb, { minLength: 1, maxLength: 10 }),
          (round, summaries) => {
            const reportData = calculateRoundReportData(round, summaries);
            
            const total = summaries.length;
            const expectedSubmissionRate = summaries.filter(s => s.status === AttendanceStatus.SUBMITTED).length / total;
            const expectedLateRate = summaries.filter(s => s.status === AttendanceStatus.LATE).length / total;
            const expectedAbsentRate = summaries.filter(s => s.status === AttendanceStatus.ABSENT).length / total;
            
            expect(reportData.submissionRate).toBeCloseTo(expectedSubmissionRate, 5);
            expect(reportData.lateRate).toBeCloseTo(expectedLateRate, 5);
            expect(reportData.absentRate).toBeCloseTo(expectedAbsentRate, 5);
            expect(reportData.totalMembers).toBe(total);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify MVP as member with most posts', () => {
      fc.assert(
        fc.property(
          roundArb,
          fc.array(
            attendanceSummaryArb.filter(s => 
              s.status === AttendanceStatus.SUBMITTED || s.status === AttendanceStatus.LATE
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (round, summaries) => {
            // Ensure at least one member has posts
            const summariesWithPosts = summaries.map((s, i) => ({
              ...s,
              postCount: i === 0 ? Math.max(1, s.postCount) : s.postCount,
            }));
            
            const reportData = calculateRoundReportData(round, summariesWithPosts);
            
            if (reportData.mvps.length > 0) {
              // All MVPs should have the highest post count among submitted/late members
              const maxPostCount = Math.max(
                ...summariesWithPosts
                  .filter(s => s.status === AttendanceStatus.SUBMITTED || s.status === AttendanceStatus.LATE)
                  .filter(s => s.postCount > 0)
                  .map(s => s.postCount)
              );
              for (const mvp of reportData.mvps) {
                expect(mvp.postCount).toBe(maxPostCount);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have no MVP when no members have posts', () => {
      fc.assert(
        fc.property(
          roundArb,
          fc.array(
            attendanceSummaryArb.map(s => ({ ...s, postCount: 0, status: AttendanceStatus.ABSENT as AttendanceStatusType })),
            { minLength: 1, maxLength: 5 }
          ),
          (round, summaries) => {
            const reportData = calculateRoundReportData(round, summaries);
            
            // No MVP when all members are absent or have 0 posts
            expect(reportData.mvps).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include statistics field in the embed', () => {
      fc.assert(
        fc.property(
          roundArb,
          fc.array(attendanceSummaryArb, { minLength: 1, maxLength: 10 }),
          (round, summaries) => {
            const reportData = calculateRoundReportData(round, summaries);
            const embed = buildRoundReportEmbed(reportData);
            const embedData = embed.toJSON();
            
            // Should have a statistics field
            const statsField = embedData.fields?.find(f => f.name.includes('통계'));
            expect(statsField).toBeDefined();
            expect(statsField?.value).toContain('제출률');
            expect(statsField?.value).toContain('지각률');
            expect(statsField?.value).toContain('결석률');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include round number in the message content', () => {
      fc.assert(
        fc.property(
          roundArb,
          fc.array(attendanceSummaryArb, { minLength: 0, maxLength: 5 }),
          (round, summaries) => {
            const reportData = calculateRoundReportData(round, summaries);
            const message = buildRoundReportMessage(reportData);
            
            // Content should mention the round number
            expect(message.content).toContain(`${round.roundNumber}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty attendance list', () => {
      fc.assert(
        fc.property(roundArb, (round) => {
          const reportData = calculateRoundReportData(round, []);
          
          expect(reportData.submitted).toHaveLength(0);
          expect(reportData.mvps).toHaveLength(0);
          expect(reportData.totalMembers).toBe(0);
          expect(reportData.submissionRate).toBe(0);
          expect(reportData.lateRate).toBe(0);
          expect(reportData.absentRate).toBe(0);
        }),
        { numRuns: 50 }
      );
    });
  });
});
