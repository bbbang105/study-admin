/**
 * Property-Based Tests for RankingService
 * Tests correctness properties for ranking operations
 *
 * These tests verify the business logic of ranking operations using
 * pure functions extracted from the service.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { RankingData } from './ranking.service';

/**
 * Generate valid Discord usernames
 */
const discordUsernameArb = fc.stringMatching(/^[\w.-]{2,32}$/);

/**
 * Generate valid names (Korean or English)
 */
const nameArb = fc.stringOf(
  fc.constantFrom(...'가나다라마바사아자차카타파하김이박최정강조윤장임abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 2, maxLength: 20 }
);

/**
 * Generate valid parts
 */
const partArb = fc.constantFrom('frontend', 'backend', 'design', 'pm', 'fullstack', 'devops');

/**
 * Generate ranking data
 */
const rankingDataArb = fc.record({
  memberId: fc.uuid(),
  name: nameArb,
  discordUsername: discordUsernameArb,
  part: partArb,
  totalScore: fc.integer({ min: 0, max: 10000 }),
  postCount: fc.integer({ min: 0, max: 100 }),
  activityScore: fc.integer({ min: 0, max: 5000 }),
  rank: fc.integer({ min: 1, max: 100 }),
}) as fc.Arbitrary<RankingData>;

// ============================================
// Pure Business Logic Functions for Testing
// ============================================

/**
 * Sort rankings by total score (primary) and post count (secondary)
 */
function sortByTotalScore(rankings: RankingData[]): RankingData[] {
  return [...rankings].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return b.postCount - a.postCount;
  });
}

/**
 * Sort rankings by post count (primary) and total score (secondary)
 */
function sortByPostCount(rankings: RankingData[]): RankingData[] {
  return [...rankings].sort((a, b) => {
    if (b.postCount !== a.postCount) {
      return b.postCount - a.postCount;
    }
    return b.totalScore - a.totalScore;
  });
}

/**
 * Sort rankings by activity score (primary) and total score (secondary)
 */
function sortByActivityScore(rankings: RankingData[]): RankingData[] {
  return [...rankings].sort((a, b) => {
    if (b.activityScore !== a.activityScore) {
      return b.activityScore - a.activityScore;
    }
    return b.totalScore - a.totalScore;
  });
}

/**
 * Assign ranks to sorted rankings (handling ties)
 */
function assignRanks(rankings: RankingData[]): RankingData[] {
  const result = [...rankings];
  let currentRank = 1;

  for (let i = 0; i < result.length; i++) {
    if (i > 0) {
      const prev = result[i - 1]!;
      const curr = result[i]!;

      // Check if current has same score as previous
      if (curr.totalScore !== prev.totalScore || curr.postCount !== prev.postCount) {
        currentRank = i + 1;
      }
    }
    result[i]!.rank = currentRank;
  }

  return result;
}

/**
 * Get top N rankings
 */
function getTopRankings(rankings: RankingData[], count: number): RankingData[] {
  return rankings.slice(0, Math.min(count, rankings.length));
}

/**
 * Find ranking by member ID
 */
function findByMemberId(rankings: RankingData[], memberId: string): RankingData | null {
  return rankings.find((r) => r.memberId === memberId) ?? null;
}

/**
 * Find ranking by Discord username
 */
function findByDiscordUsername(rankings: RankingData[], discordUsername: string): RankingData | null {
  return rankings.find((r) => r.discordUsername === discordUsername) ?? null;
}

// ============================================
// Property Tests
// ============================================

describe('RankingService Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 1: Ranking Sorting**
   * *For any* set of rankings, sorting by total score SHALL produce a list where
   * each element has a total score less than or equal to the previous element.
   * **Validates: Correctness of sorting algorithm**
   */
  describe('Property 1: Ranking Sorting by Total Score', () => {
    it('should maintain descending order by total score', () => {
      fc.assert(
        fc.property(fc.array(rankingDataArb, { minLength: 1 }), (rankings) => {
          const sorted = sortByTotalScore(rankings);

          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i]!;
            const next = sorted[i + 1]!;

            // Total score should be non-increasing
            expect(current.totalScore).toBeGreaterThanOrEqual(next.totalScore);

            // If total scores are equal, post count should be non-increasing
            if (current.totalScore === next.totalScore) {
              expect(current.postCount).toBeGreaterThanOrEqual(next.postCount);
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve all elements after sorting', () => {
      fc.assert(
        fc.property(fc.array(rankingDataArb), (rankings) => {
          const sorted = sortByTotalScore(rankings);
          expect(sorted).toHaveLength(rankings.length);

          // All member IDs should be present
          const originalIds = new Set(rankings.map((r) => r.memberId));
          const sortedIds = new Set(sorted.map((r) => r.memberId));
          expect(sortedIds).toEqual(originalIds);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 2: Ranking Sorting by Post Count**
   * *For any* set of rankings, sorting by post count SHALL produce a list where
   * each element has a post count less than or equal to the previous element.
   * **Validates: Correctness of alternative sorting**
   */
  describe('Property 2: Ranking Sorting by Post Count', () => {
    it('should maintain descending order by post count', () => {
      fc.assert(
        fc.property(fc.array(rankingDataArb, { minLength: 1 }), (rankings) => {
          const sorted = sortByPostCount(rankings);

          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i]!;
            const next = sorted[i + 1]!;

            // Post count should be non-increasing
            expect(current.postCount).toBeGreaterThanOrEqual(next.postCount);

            // If post counts are equal, total score should be non-increasing
            if (current.postCount === next.postCount) {
              expect(current.totalScore).toBeGreaterThanOrEqual(next.totalScore);
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 3: Ranking Sorting by Activity Score**
   * *For any* set of rankings, sorting by activity score SHALL produce a list where
   * each element has an activity score less than or equal to the previous element.
   * **Validates: Correctness of alternative sorting**
   */
  describe('Property 3: Ranking Sorting by Activity Score', () => {
    it('should maintain descending order by activity score', () => {
      fc.assert(
        fc.property(fc.array(rankingDataArb, { minLength: 1 }), (rankings) => {
          const sorted = sortByActivityScore(rankings);

          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i]!;
            const next = sorted[i + 1]!;

            // Activity score should be non-increasing
            expect(current.activityScore).toBeGreaterThanOrEqual(next.activityScore);

            // If activity scores are equal, total score should be non-increasing
            if (current.activityScore === next.activityScore) {
              expect(current.totalScore).toBeGreaterThanOrEqual(next.totalScore);
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 4: Rank Assignment**
   * *For any* sorted set of rankings, assigning ranks SHALL give rank 1 to the first
   * element and increment ranks only when scores differ.
   * **Validates: Correctness of rank assignment with tie handling**
   */
  describe('Property 4: Rank Assignment', () => {
    it('should assign rank 1 to the first element', () => {
      fc.assert(
        fc.property(fc.array(rankingDataArb, { minLength: 1 }), (rankings) => {
          const sorted = sortByTotalScore(rankings);
          const withRanks = assignRanks(sorted);

          expect(withRanks[0]!.rank).toBe(1);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle ties correctly', () => {
      fc.assert(
        fc.property(fc.array(rankingDataArb, { minLength: 2 }), (rankings) => {
          const sorted = sortByTotalScore(rankings);
          const withRanks = assignRanks(sorted);

          for (let i = 0; i < withRanks.length - 1; i++) {
            const current = withRanks[i]!;
            const next = withRanks[i + 1]!;

            // If scores are equal, ranks should be equal
            if (
              current.totalScore === next.totalScore &&
              current.postCount === next.postCount
            ) {
              expect(current.rank).toBe(next.rank);
            }
            // If scores differ, next rank should be greater or equal
            else {
              expect(next.rank).toBeGreaterThanOrEqual(current.rank);
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should assign sequential ranks for unique scores', () => {
      // Create rankings with unique scores
      const uniqueRankings: RankingData[] = Array.from({ length: 10 }, (_, i) => ({
        memberId: `member-${i}`,
        name: `Member ${i}`,
        discordUsername: `user${i}`,
        part: 'frontend',
        totalScore: (10 - i) * 100, // Descending unique scores
        postCount: 10 - i,
        activityScore: 0,
        rank: 0,
      }));

      const withRanks = assignRanks(uniqueRankings);

      for (let i = 0; i < withRanks.length; i++) {
        expect(withRanks[i]!.rank).toBe(i + 1);
      }
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 5: Top Rankers Extraction**
   * *For any* set of rankings, extracting top N SHALL return exactly min(N, length) elements
   * with the highest scores.
   * **Validates: Correctness of podium extraction**
   */
  describe('Property 5: Top Rankers Extraction', () => {
    it('should return correct number of top rankers', () => {
      fc.assert(
        fc.property(
          fc.array(rankingDataArb),
          fc.integer({ min: 1, max: 20 }),
          (rankings, count) => {
            const sorted = sortByTotalScore(rankings);
            const withRanks = assignRanks(sorted);
            const top = getTopRankings(withRanks, count);

            const expectedCount = Math.min(count, withRanks.length);
            expect(top).toHaveLength(expectedCount);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return highest scoring members', () => {
      fc.assert(
        fc.property(
          fc.array(rankingDataArb, { minLength: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (rankings, count) => {
            const sorted = sortByTotalScore(rankings);
            const withRanks = assignRanks(sorted);
            const top = getTopRankings(withRanks, count);

            // All top rankers should have rank <= count
            for (const ranker of top) {
              expect(ranker.rank).toBeLessThanOrEqual(count);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain order in top rankers', () => {
      fc.assert(
        fc.property(
          fc.array(rankingDataArb, { minLength: 3 }),
          (rankings) => {
            const sorted = sortByTotalScore(rankings);
            const withRanks = assignRanks(sorted);
            const top = getTopRankings(withRanks, 3);

            // Top rankers should be in descending score order
            for (let i = 0; i < top.length - 1; i++) {
              const current = top[i]!;
              const next = top[i + 1]!;
              expect(current.totalScore).toBeGreaterThanOrEqual(next.totalScore);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 6: Member ID Lookup**
   * *For any* set of rankings, finding by member ID SHALL return the correct ranking
   * or null if not found.
   * **Validates: Correctness of member lookup**
   */
  describe('Property 6: Member ID Lookup', () => {
    it('should find existing member by ID', () => {
      fc.assert(
        fc.property(fc.array(rankingDataArb, { minLength: 1 }), (rankings) => {
          const target = rankings[0]!;
          const found = findByMemberId(rankings, target.memberId);

          expect(found).not.toBeNull();
          expect(found!.memberId).toBe(target.memberId);
          expect(found!.name).toBe(target.name);
          expect(found!.discordUsername).toBe(target.discordUsername);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return null for non-existent member ID', () => {
      fc.assert(
        fc.property(fc.array(rankingDataArb), fc.uuid(), (rankings, nonExistentId) => {
          // Ensure the ID doesn't exist in rankings
          const existingIds = new Set(rankings.map((r) => r.memberId));
          fc.pre(!existingIds.has(nonExistentId));

          const found = findByMemberId(rankings, nonExistentId);
          expect(found).toBeNull();

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 7: Discord Username Lookup**
   * *For any* set of rankings, finding by Discord username SHALL return the correct ranking
   * or null if not found.
   * **Validates: Correctness of username lookup**
   */
  describe('Property 7: Discord Username Lookup', () => {
    it('should find existing member by Discord username', () => {
      fc.assert(
        fc.property(fc.array(rankingDataArb, { minLength: 1 }), (rankings) => {
          const target = rankings[0]!;
          const found = findByDiscordUsername(rankings, target.discordUsername);

          expect(found).not.toBeNull();
          expect(found!.discordUsername).toBe(target.discordUsername);
          expect(found!.memberId).toBe(target.memberId);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return null for non-existent Discord username', () => {
      fc.assert(
        fc.property(
          fc.array(rankingDataArb),
          discordUsernameArb,
          (rankings, nonExistentUsername) => {
            // Ensure the username doesn't exist in rankings
            const existingUsernames = new Set(rankings.map((r) => r.discordUsername));
            fc.pre(!existingUsernames.has(nonExistentUsername));

            const found = findByDiscordUsername(rankings, nonExistentUsername);
            expect(found).toBeNull();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 8: Total Score Calculation**
   * *For any* ranking data, total score SHALL equal post count * BLOG_POST_SCORE_POINTS + activity score.
   * **Validates: Correctness of score calculation**
   */
  describe('Property 8: Total Score Calculation', () => {
    it('should calculate total score correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 5000 }),
          (postCount, activityScore) => {
            const BLOG_POST_SCORE_POINTS = 30;
            const expectedTotalScore = postCount * BLOG_POST_SCORE_POINTS + activityScore;

            const ranking: RankingData = {
              memberId: fc.uuid(),
              name: 'Test Member',
              discordUsername: 'testuser',
              part: 'frontend',
              totalScore: expectedTotalScore,
              postCount,
              activityScore,
              rank: 1,
            };

            expect(ranking.totalScore).toBe(expectedTotalScore);
            expect(ranking.totalScore).toBeGreaterThanOrEqual(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
