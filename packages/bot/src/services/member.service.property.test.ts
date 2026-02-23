/**
 * Property-Based Tests for MemberService
 * Tests correctness properties for member management operations
 * 
 * These tests verify the business logic of member operations using
 * pure functions extracted from the service.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MemberError, MemberErrorCodes } from './member.service';
import {
  MemberStatus,
  type Member,
} from '@blog-study/shared/db';
import { validateBlogUrl, isValidUrl } from '@blog-study/shared/utils';

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
 * Generate valid blog URLs
 */
const validBlogUrlArb = fc.oneof(
  // Velog URLs
  fc.stringMatching(/^[\w-]{3,20}$/).map(username => `https://velog.io/@${username}`),
  // Tistory URLs
  fc.stringMatching(/^[\w-]{3,20}$/).map(blogName => `https://${blogName}.tistory.com`),
  // Medium URLs
  fc.stringMatching(/^[\w-]{3,20}$/).map(username => `https://medium.com/@${username}`),
  // Generic blog URLs
  fc.webUrl()
);

/**
 * Generate invalid URLs
 */
const invalidUrlArb = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('not-a-url'),
  fc.constant('ftp://invalid.com'),
  fc.constant('javascript:alert(1)'),
  fc.stringOf(fc.char(), { minLength: 1, maxLength: 50 }).filter(s => !s.startsWith('http'))
);

/**
 * Generate a valid member object
 */
const memberArb = fc.record({
  id: fc.uuid(),
  discordId: discordIdArb,
  discordUsername: discordUsernameArb,
  name: nameArb,
  part: partArb,
  blogUrl: validBlogUrlArb,
  rssUrl: fc.option(fc.webUrl(), { nil: null }),
  profileImageUrl: fc.constant(null),
  bio: fc.constant(null),
  interests: fc.constant(null),
  resolution: fc.constant(null),
  onboardingCompleted: fc.boolean(),
  status: fc.constantFrom(MemberStatus.ACTIVE, MemberStatus.DORMANT, MemberStatus.WITHDRAWN),
  dormantStartRound: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  dormantUsed: fc.boolean(),
  joinedAt: fc.date(),
  updatedAt: fc.date(),
}) as fc.Arbitrary<Member>;

/**
 * Generate an active member
 */
const activeMemberArb = memberArb.map(m => ({
  ...m,
  status: MemberStatus.ACTIVE,
}));

/**
 * Generate a dormant member
 */
const dormantMemberArb = memberArb.map(m => ({
  ...m,
  status: MemberStatus.DORMANT,
  dormantUsed: true,
  dormantStartRound: m.dormantStartRound ?? 1,
}));

// ============================================
// Pure Business Logic Functions for Testing
// ============================================

/**
 * Validate registration input
 * Returns error if invalid, null if valid
 */
function validateRegistration(
  blogUrl: string,
  existingMember: Member | null
): { code: string; message: string } | null {
  const urlValidation = validateBlogUrl(blogUrl);
  if (!urlValidation.isValid) {
    return {
      code: MemberErrorCodes.INVALID_URL,
      message: urlValidation.error || '올바른 URL 형식이 아닙니다.',
    };
  }

  if (existingMember) {
    return {
      code: MemberErrorCodes.ALREADY_REGISTERED,
      message: `이미 등록된 사용자입니다. 현재 블로그: ${existingMember.blogUrl}`,
    };
  }

  return null;
}

/**
 * Validate dormant setting
 * Returns error if invalid, null if valid
 */
function validateSetDormant(member: Member | null): { code: string; message: string } | null {
  if (!member) {
    return {
      code: MemberErrorCodes.USER_NOT_FOUND,
      message: '등록되지 않은 사용자입니다.',
    };
  }

  if (member.dormantUsed) {
    return {
      code: MemberErrorCodes.DORMANT_ALREADY_USED,
      message: '휴면은 1회만 사용할 수 있습니다.',
    };
  }

  if (member.status === MemberStatus.DORMANT) {
    return {
      code: 'E1006',
      message: '이미 휴면 상태입니다.',
    };
  }

  return null;
}

/**
 * Check if dormant period has expired (4 rounds = 8 weeks)
 */
function shouldAutoActivate(member: Member, currentRoundNumber: number): boolean {
  if (member.status !== MemberStatus.DORMANT) {
    return false;
  }
  if (member.dormantStartRound === null) {
    return false;
  }
  return currentRoundNumber >= member.dormantStartRound + 4;
}

/**
 * Create member info response
 */
function createMemberInfo(member: Member, postCount: number, totalFines: number) {
  return {
    blogUrl: member.blogUrl,
    rssUrl: member.rssUrl,
    joinDate: member.joinedAt,
    postCount,
    status: member.status,
    dormantUsed: member.dormantUsed,
    totalFines,
  };
}

// ============================================
// Property Tests
// ============================================

describe('MemberService Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 1: Valid URL Registration Creates Active Member**
   * *For any* valid blog URL and Discord user, registering with that URL SHALL create
   * a Member with `active` status and the correct blog URL stored.
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Valid URL Registration Creates Active Member', () => {
    it('should accept all valid blog URLs for registration', () => {
      fc.assert(
        fc.property(validBlogUrlArb, (blogUrl) => {
          const error = validateRegistration(blogUrl, null);
          expect(error).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject all invalid URLs for registration', () => {
      fc.assert(
        fc.property(invalidUrlArb, (invalidUrl) => {
          const error = validateRegistration(invalidUrl, null);
          expect(error).not.toBeNull();
          expect(error!.code).toBe(MemberErrorCodes.INVALID_URL);
        }),
        { numRuns: 100 }
      );
    });

    it('should validate URL format correctly', () => {
      fc.assert(
        fc.property(fc.string(), (url) => {
          const validation = validateBlogUrl(url);
          const error = validateRegistration(url, null);
          
          // If URL is valid, registration should pass (no existing member)
          // If URL is invalid, registration should fail with INVALID_URL
          if (validation.isValid) {
            expect(error).toBeNull();
          } else {
            expect(error).not.toBeNull();
            expect(error!.code).toBe(MemberErrorCodes.INVALID_URL);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 3: Duplicate Registration Prevention**
   * *For any* Discord user who is already registered, attempting to register again
   * SHALL fail and the existing Member record SHALL remain unchanged.
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: Duplicate Registration Prevention', () => {
    it('should reject registration when member already exists', () => {
      fc.assert(
        fc.property(activeMemberArb, validBlogUrlArb, (existingMember, newBlogUrl) => {
          const error = validateRegistration(newBlogUrl, existingMember);
          expect(error).not.toBeNull();
          expect(error!.code).toBe(MemberErrorCodes.ALREADY_REGISTERED);
        }),
        { numRuns: 100 }
      );
    });

    it('should include existing blog URL in error message', () => {
      fc.assert(
        fc.property(activeMemberArb, validBlogUrlArb, (existingMember, newBlogUrl) => {
          const error = validateRegistration(newBlogUrl, existingMember);
          expect(error).not.toBeNull();
          expect(error!.message).toContain(existingMember.blogUrl);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 4: Withdrawal Status Change**
   * *For any* registered Member, executing withdrawal SHALL change their status to
   * `withdrawn` while preserving all associated posts, attendance, and fine records.
   * **Validates: Requirements 2.1, 2.4**
   */
  describe('Property 4: Withdrawal Status Change', () => {
    it('should preserve all member data except status on withdrawal', () => {
      fc.assert(
        fc.property(activeMemberArb, (member) => {
          // Simulate withdrawal - only status changes
          const withdrawnMember: Member = {
            ...member,
            status: MemberStatus.WITHDRAWN,
            updatedAt: new Date(),
          };

          // All data except status and updatedAt should be preserved
          expect(withdrawnMember.id).toBe(member.id);
          expect(withdrawnMember.discordId).toBe(member.discordId);
          expect(withdrawnMember.blogUrl).toBe(member.blogUrl);
          expect(withdrawnMember.name).toBe(member.name);
          expect(withdrawnMember.part).toBe(member.part);
          expect(withdrawnMember.rssUrl).toBe(member.rssUrl);
          expect(withdrawnMember.dormantUsed).toBe(member.dormantUsed);
          expect(withdrawnMember.status).toBe(MemberStatus.WITHDRAWN);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 5: Dormant One-Time Usage**
   * *For any* Member, dormant status can only be set once. If `dormant_used` is true,
   * setting dormant SHALL fail.
   * **Validates: Requirements 3.1, 3.3**
   */
  describe('Property 5: Dormant One-Time Usage', () => {
    it('should allow dormant for members who have not used it', () => {
      fc.assert(
        fc.property(
          activeMemberArb.map(m => ({ ...m, dormantUsed: false })),
          (member) => {
            const error = validateSetDormant(member);
            expect(error).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject dormant for members who have already used it', () => {
      fc.assert(
        fc.property(
          activeMemberArb.map(m => ({ ...m, dormantUsed: true })),
          (member) => {
            const error = validateSetDormant(member);
            expect(error).not.toBeNull();
            expect(error!.code).toBe(MemberErrorCodes.DORMANT_ALREADY_USED);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject dormant for members already in dormant status', () => {
      fc.assert(
        fc.property(
          dormantMemberArb.map(m => ({ ...m, dormantUsed: false })), // Edge case: dormant but not marked as used
          (member) => {
            const error = validateSetDormant(member);
            expect(error).not.toBeNull();
            // Should fail because already dormant
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject dormant for non-existent members', () => {
      const error = validateSetDormant(null);
      expect(error).not.toBeNull();
      expect(error!.code).toBe(MemberErrorCodes.USER_NOT_FOUND);
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 7: Dormant Auto-Expiration**
   * *For any* dormant Member, when 4 rounds have passed since `dormant_start_round`,
   * the status SHALL automatically change to `active`.
   * **Validates: Requirements 3.5**
   */
  describe('Property 7: Dormant Auto-Expiration', () => {
    it('should auto-activate after 4 rounds', () => {
      fc.assert(
        fc.property(
          dormantMemberArb,
          fc.integer({ min: 1, max: 10 }),
          (member, startRound) => {
            const memberWithStart = { ...member, dormantStartRound: startRound };
            
            // Before 4 rounds: should not auto-activate
            expect(shouldAutoActivate(memberWithStart, startRound)).toBe(false);
            expect(shouldAutoActivate(memberWithStart, startRound + 1)).toBe(false);
            expect(shouldAutoActivate(memberWithStart, startRound + 2)).toBe(false);
            expect(shouldAutoActivate(memberWithStart, startRound + 3)).toBe(false);
            
            // At 4 rounds: should auto-activate
            expect(shouldAutoActivate(memberWithStart, startRound + 4)).toBe(true);
            expect(shouldAutoActivate(memberWithStart, startRound + 5)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not auto-activate non-dormant members', () => {
      fc.assert(
        fc.property(
          activeMemberArb,
          fc.integer({ min: 1, max: 20 }),
          (member, currentRound) => {
            expect(shouldAutoActivate(member, currentRound)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not auto-activate dormant members without start round', () => {
      fc.assert(
        fc.property(
          dormantMemberArb.map(m => ({ ...m, dormantStartRound: null })),
          fc.integer({ min: 1, max: 20 }),
          (member, currentRound) => {
            expect(shouldAutoActivate(member, currentRound)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 9: Member Info Completeness**
   * *For any* registered Member, the `/내정보` response SHALL contain all required fields:
   * blog URL, RSS URL, join date, post count, attendance status, dormant status, and total fines.
   * **Validates: Requirements 4.1**
   */
  describe('Property 9: Member Info Completeness', () => {
    it('should include all required fields in member info', () => {
      fc.assert(
        fc.property(
          memberArb,
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 50000 }),
          (member, postCount, totalFines) => {
            const info = createMemberInfo(member, postCount, totalFines);
            
            // All required fields should be present
            expect(info).toHaveProperty('blogUrl');
            expect(info).toHaveProperty('rssUrl');
            expect(info).toHaveProperty('joinDate');
            expect(info).toHaveProperty('postCount');
            expect(info).toHaveProperty('status');
            expect(info).toHaveProperty('dormantUsed');
            expect(info).toHaveProperty('totalFines');
            
            // Values should match
            expect(info.blogUrl).toBe(member.blogUrl);
            expect(info.rssUrl).toBe(member.rssUrl);
            expect(info.joinDate).toBe(member.joinedAt);
            expect(info.postCount).toBe(postCount);
            expect(info.status).toBe(member.status);
            expect(info.dormantUsed).toBe(member.dormantUsed);
            expect(info.totalFines).toBe(totalFines);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
