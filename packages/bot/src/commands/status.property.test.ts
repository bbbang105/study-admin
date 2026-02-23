/**
 * Property-Based Tests for Status Display Commands
 * Tests correctness properties for 현황, 랭킹, 통계 commands
 * 
 * These tests verify the business logic of status display operations using
 * pure functions extracted from the commands.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  AttendanceStatus,
  MemberStatus,
  type Member,
  type Attendance,
  type AttendanceStatusType,
  type MemberStatusType,
} from '@blog-study/shared/db';
import { getDaysUntilDeadline, getDaysUntilGraceEnd, type RoundDates } from '@blog-study/shared/utils';

// ============================================
// Arbitraries for generating test data
// ============================================

/**
 * Generate valid UUIDs
 */
const uuidArb = fc.uuid();

/**
 * Generate valid round IDs
 */
const roundIdArb = fc.integer({ min: 1, max: 52 });

/**
 * Generate valid attendance status
 */
const attendanceStatusArb = fc.constantFrom(
  AttendanceStatus.PENDING,
  AttendanceStatus.SUBMITTED,
  AttendanceStatus.LATE,
  AttendanceStatus.ABSENT
) as fc.Arbitrary<AttendanceStatusType>;

/**
 * Generate valid member status (active or dormant for rankings)
 */
const memberStatusArb = fc.constantFrom(
  MemberStatus.ACTIVE,
  MemberStatus.DORMANT
) as fc.Arbitrary<MemberStatusType>;

/**
 * Generate a valid member (simplified for faster tests)
 */
const memberArb = fc.record({
  id: uuidArb,
  discordId: fc.stringMatching(/^\d{17,19}$/),
  discordUsername: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  part: fc.constantFrom('frontend', 'backend', 'design', 'pm', 'fullstack'),
  blogUrl: fc.constant('https://example.com/blog'),
  rssUrl: fc.constant(null),
  profileImageUrl: fc.constant(null),
  bio: fc.constant(null),
  interests: fc.constant(null),
  resolution: fc.constant(null),
  onboardingCompleted: fc.constant(false),
  status: memberStatusArb,
  dormantStartRound: fc.constant(null),
  dormantUsed: fc.constant(false),
  joinedAt: fc.constant(new Date('2024-06-01')),
  updatedAt: fc.constant(new Date('2024-06-01')),
}) as fc.Arbitrary<Member>;

/**
 * Generate attendance record
 */
const attendanceArb = fc.record({
  id: uuidArb,
  memberId: uuidArb,
  roundId: roundIdArb,
  status: attendanceStatusArb,
  submittedAt: fc.option(fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }), { nil: null }),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
}) as fc.Arbitrary<Attendance>;

// ============================================
// Pure Business Logic Functions for Testing
// ============================================

/**
 * Group members by attendance status
 * Requirements: 9.1 - Display current round attendance status for all active members
 */
interface StatusGroups {
  submitted: Member[];
  pending: Member[];
  late: Member[];
  absent: Member[];
}

function groupMembersByStatus(
  members: Member[],
  attendanceMap: Map<string, AttendanceStatusType>
): StatusGroups {
  const groups: StatusGroups = {
    submitted: [],
    pending: [],
    late: [],
    absent: [],
  };

  for (const member of members) {
    const status = attendanceMap.get(member.id) || AttendanceStatus.PENDING;
    
    switch (status) {
      case AttendanceStatus.SUBMITTED:
        groups.submitted.push(member);
        break;
      case AttendanceStatus.LATE:
        groups.late.push(member);
        break;
      case AttendanceStatus.ABSENT:
        groups.absent.push(member);
        break;
      default:
        groups.pending.push(member);
        break;
    }
  }

  return groups;
}

/**
 * Calculate remaining days info
 * Requirements: 9.2 - Show days remaining until deadline and grace period end
 */
interface RemainingDaysInfo {
  daysUntilDeadline: number;
  daysUntilGraceEnd: number;
  isGracePeriod: boolean;
  isCompleted: boolean;
}

function calculateRemainingDays(
  roundDates: RoundDates,
  currentDate: Date
): RemainingDaysInfo {
  const daysUntilDeadline = getDaysUntilDeadline(roundDates, currentDate);
  const daysUntilGraceEnd = getDaysUntilGraceEnd(roundDates, currentDate);
  
  return {
    daysUntilDeadline,
    daysUntilGraceEnd,
    isGracePeriod: daysUntilDeadline === 0 && daysUntilGraceEnd > 0,
    isCompleted: daysUntilDeadline === 0 && daysUntilGraceEnd === 0,
  };
}

/**
 * Ranking entry with member info and stats
 * Requirements: 9.3, 9.5 - Ranking by post count with attendance rate
 */
interface RankingEntry {
  member: Member;
  postCount: number;
  attendanceRate: number;
  submittedRounds: number;
  totalRounds: number;
}

/**
 * Sort rankings by post count descending, then by attendance rate
 * Requirements: 9.3 - Display cumulative post count ranking in descending order
 */
function sortRankings(rankings: RankingEntry[]): RankingEntry[] {
  return [...rankings].sort((a, b) => {
    if (b.postCount !== a.postCount) {
      return b.postCount - a.postCount;
    }
    return b.attendanceRate - a.attendanceRate;
  });
}

/**
 * Calculate attendance rate
 * Requirements: 9.5 - Include attendance rate for each member
 */
function calculateAttendanceRate(submittedRounds: number, totalRounds: number): number {
  if (totalRounds === 0) return 0;
  return Math.round((submittedRounds / totalRounds) * 100);
}

/**
 * Round statistics
 * Requirements: 9.4 - Round statistics calculation
 */
interface RoundStatistics {
  totalMembers: number;
  submittedCount: number;
  lateCount: number;
  absentCount: number;
  pendingCount: number;
  submissionRate: number;
  lateRate: number;
  absentRate: number;
}

/**
 * Calculate round statistics from attendance records
 * Requirements: 9.4 - Calculate submission rate, late rate, absent rate
 */
function calculateRoundStatistics(attendanceRecords: Attendance[]): RoundStatistics {
  let submittedCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let pendingCount = 0;

  for (const record of attendanceRecords) {
    switch (record.status) {
      case AttendanceStatus.SUBMITTED:
        submittedCount++;
        break;
      case AttendanceStatus.LATE:
        lateCount++;
        break;
      case AttendanceStatus.ABSENT:
        absentCount++;
        break;
      default:
        pendingCount++;
        break;
    }
  }

  const totalMembers = attendanceRecords.length;
  
  // Submission rate includes both submitted and late
  const submissionRate = totalMembers > 0 
    ? Math.round(((submittedCount + lateCount) / totalMembers) * 100) 
    : 0;
  const lateRate = totalMembers > 0 
    ? Math.round((lateCount / totalMembers) * 100) 
    : 0;
  const absentRate = totalMembers > 0 
    ? Math.round((absentCount / totalMembers) * 100) 
    : 0;

  return {
    totalMembers,
    submittedCount,
    lateCount,
    absentCount,
    pendingCount,
    submissionRate,
    lateRate,
    absentRate,
  };
}

// ============================================
// Property Tests
// ============================================

describe('Status Display Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 24: Current Status Display**
   * *For any* `/현황` command, the response SHALL show all active Members' 
   * attendance status for the current round with remaining days until deadline.
   * **Validates: Requirements 9.1, 9.2**
   */
  describe('Property 24: Current Status Display', () => {
    it('should group all active members by their attendance status', () => {
      fc.assert(
        fc.property(
          fc.array(memberArb, { minLength: 1, maxLength: 20 }),
          fc.array(attendanceStatusArb, { minLength: 1, maxLength: 20 }),
          (members, statuses) => {
            // Filter to only active members
            const activeMembers = members.filter(m => m.status === MemberStatus.ACTIVE);
            fc.pre(activeMembers.length > 0);
            
            // Create attendance map
            const attendanceMap = new Map<string, AttendanceStatusType>();
            activeMembers.forEach((member, index) => {
              const status = statuses[index % statuses.length];
              if (status) {
                attendanceMap.set(member.id, status);
              }
            });
            
            // Group members
            const groups = groupMembersByStatus(activeMembers, attendanceMap);
            
            // Verify all members are accounted for
            const totalGrouped = 
              groups.submitted.length + 
              groups.pending.length + 
              groups.late.length + 
              groups.absent.length;
            
            expect(totalGrouped).toBe(activeMembers.length);
            
            // Verify each member is in exactly one group
            const allGroupedIds = [
              ...groups.submitted.map(m => m.id),
              ...groups.pending.map(m => m.id),
              ...groups.late.map(m => m.id),
              ...groups.absent.map(m => m.id),
            ];
            const uniqueIds = new Set(allGroupedIds);
            expect(uniqueIds.size).toBe(activeMembers.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly assign members to status groups based on attendance', () => {
      fc.assert(
        fc.property(
          fc.array(memberArb.filter(m => m.status === MemberStatus.ACTIVE), { minLength: 1, maxLength: 10 }),
          (activeMembers) => {
            // Create specific attendance statuses
            const attendanceMap = new Map<string, AttendanceStatusType>();
            activeMembers.forEach((member, index) => {
              const statuses: AttendanceStatusType[] = [
                AttendanceStatus.SUBMITTED,
                AttendanceStatus.PENDING,
                AttendanceStatus.LATE,
                AttendanceStatus.ABSENT,
              ];
              attendanceMap.set(member.id, statuses[index % 4]!);
            });
            
            const groups = groupMembersByStatus(activeMembers, attendanceMap);
            
            // Verify each member is in the correct group
            for (const member of groups.submitted) {
              expect(attendanceMap.get(member.id)).toBe(AttendanceStatus.SUBMITTED);
            }
            for (const member of groups.late) {
              expect(attendanceMap.get(member.id)).toBe(AttendanceStatus.LATE);
            }
            for (const member of groups.absent) {
              expect(attendanceMap.get(member.id)).toBe(AttendanceStatus.ABSENT);
            }
            for (const member of groups.pending) {
              const status = attendanceMap.get(member.id);
              expect(status === AttendanceStatus.PENDING || status === undefined).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate remaining days correctly', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }),
          (startDate) => {
            // Create round dates
            const roundDates: RoundDates = {
              roundNumber: 1,
              startDate: new Date(startDate),
              endDate: new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000), // +13 days
              graceEndDate: new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000), // +14 days
            };
            roundDates.endDate.setHours(23, 59, 59, 999);
            roundDates.graceEndDate.setHours(23, 59, 59, 999);
            
            // Test before deadline
            const beforeDeadline = new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000);
            const infoBefore = calculateRemainingDays(roundDates, beforeDeadline);
            expect(infoBefore.daysUntilDeadline).toBeGreaterThan(0);
            expect(infoBefore.isGracePeriod).toBe(false);
            expect(infoBefore.isCompleted).toBe(false);
            
            // Test during grace period
            const duringGrace = new Date(roundDates.endDate.getTime() + 12 * 60 * 60 * 1000); // +12 hours after deadline
            const infoDuring = calculateRemainingDays(roundDates, duringGrace);
            expect(infoDuring.daysUntilDeadline).toBe(0);
            expect(infoDuring.daysUntilGraceEnd).toBeGreaterThan(0);
            expect(infoDuring.isGracePeriod).toBe(true);
            expect(infoDuring.isCompleted).toBe(false);
            
            // Test after grace period
            const afterGrace = new Date(roundDates.graceEndDate.getTime() + 24 * 60 * 60 * 1000);
            const infoAfter = calculateRemainingDays(roundDates, afterGrace);
            expect(infoAfter.daysUntilDeadline).toBe(0);
            expect(infoAfter.daysUntilGraceEnd).toBe(0);
            expect(infoAfter.isCompleted).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should default to pending status for members without attendance records', () => {
      fc.assert(
        fc.property(
          fc.array(memberArb.filter(m => m.status === MemberStatus.ACTIVE), { minLength: 1, maxLength: 10 }),
          (activeMembers) => {
            // Empty attendance map - no records
            const attendanceMap = new Map<string, AttendanceStatusType>();
            
            const groups = groupMembersByStatus(activeMembers, attendanceMap);
            
            // All members should be in pending group
            expect(groups.pending.length).toBe(activeMembers.length);
            expect(groups.submitted.length).toBe(0);
            expect(groups.late.length).toBe(0);
            expect(groups.absent.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 25: Ranking Order**
   * *For any* set of Members, the ranking SHALL be sorted by cumulative post count 
   * in descending order, with attendance rate included.
   * **Validates: Requirements 9.3, 9.5**
   */
  describe('Property 25: Ranking Order', () => {
    it('should sort rankings by post count in descending order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              member: memberArb,
              postCount: fc.integer({ min: 0, max: 100 }),
              attendanceRate: fc.integer({ min: 0, max: 100 }),
              submittedRounds: fc.integer({ min: 0, max: 52 }),
              totalRounds: fc.integer({ min: 0, max: 52 }),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (rankings) => {
            const sorted = sortRankings(rankings);
            
            // Verify descending order by post count
            for (let i = 0; i < sorted.length - 1; i++) {
              const current = sorted[i]!;
              const next = sorted[i + 1]!;
              
              // Post count should be >= next
              expect(current.postCount).toBeGreaterThanOrEqual(next.postCount);
              
              // If post counts are equal, attendance rate should be >= next
              if (current.postCount === next.postCount) {
                expect(current.attendanceRate).toBeGreaterThanOrEqual(next.attendanceRate);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all ranking entries after sorting', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              member: memberArb,
              postCount: fc.integer({ min: 0, max: 100 }),
              attendanceRate: fc.integer({ min: 0, max: 100 }),
              submittedRounds: fc.integer({ min: 0, max: 52 }),
              totalRounds: fc.integer({ min: 0, max: 52 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (rankings) => {
            const sorted = sortRankings(rankings);
            
            // Same length
            expect(sorted.length).toBe(rankings.length);
            
            // All original entries should be present
            const originalIds = new Set(rankings.map(r => r.member.id));
            const sortedIds = new Set(sorted.map(r => r.member.id));
            expect(sortedIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate attendance rate correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 52 }),
          fc.integer({ min: 0, max: 52 }),
          (submitted, total) => {
            // Ensure submitted <= total
            const actualSubmitted = Math.min(submitted, total);
            
            const rate = calculateAttendanceRate(actualSubmitted, total);
            
            if (total === 0) {
              expect(rate).toBe(0);
            } else {
              const expectedRate = Math.round((actualSubmitted / total) * 100);
              expect(rate).toBe(expectedRate);
              expect(rate).toBeGreaterThanOrEqual(0);
              expect(rate).toBeLessThanOrEqual(100);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty rankings', () => {
      const sorted = sortRankings([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single entry rankings', () => {
      fc.assert(
        fc.property(
          fc.record({
            member: memberArb,
            postCount: fc.integer({ min: 0, max: 100 }),
            attendanceRate: fc.integer({ min: 0, max: 100 }),
            submittedRounds: fc.integer({ min: 0, max: 52 }),
            totalRounds: fc.integer({ min: 0, max: 52 }),
          }),
          (entry) => {
            const sorted = sortRankings([entry]);
            expect(sorted.length).toBe(1);
            expect(sorted[0]).toEqual(entry);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 26: Round Statistics Calculation**
   * *For any* round, statistics SHALL correctly calculate: submission rate, 
   * late rate, absent rate based on attendance records.
   * **Validates: Requirements 9.4**
   */
  describe('Property 26: Round Statistics Calculation', () => {
    it('should correctly count attendance by status', () => {
      fc.assert(
        fc.property(
          fc.array(attendanceArb, { minLength: 1, maxLength: 50 }),
          (records) => {
            const stats = calculateRoundStatistics(records);
            
            // Total should equal sum of all categories
            const totalCounted = 
              stats.submittedCount + 
              stats.lateCount + 
              stats.absentCount + 
              stats.pendingCount;
            
            expect(totalCounted).toBe(stats.totalMembers);
            expect(stats.totalMembers).toBe(records.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate rates that sum correctly', () => {
      fc.assert(
        fc.property(
          fc.array(attendanceArb, { minLength: 1, maxLength: 50 }),
          (records) => {
            const stats = calculateRoundStatistics(records);
            
            // Submission rate includes both submitted and late
            if (stats.totalMembers > 0) {
              const expectedSubmissionRate = Math.round(
                ((stats.submittedCount + stats.lateCount) / stats.totalMembers) * 100
              );
              expect(stats.submissionRate).toBe(expectedSubmissionRate);
              
              const expectedLateRate = Math.round(
                (stats.lateCount / stats.totalMembers) * 100
              );
              expect(stats.lateRate).toBe(expectedLateRate);
              
              const expectedAbsentRate = Math.round(
                (stats.absentCount / stats.totalMembers) * 100
              );
              expect(stats.absentRate).toBe(expectedAbsentRate);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty attendance records', () => {
      const stats = calculateRoundStatistics([]);
      
      expect(stats.totalMembers).toBe(0);
      expect(stats.submittedCount).toBe(0);
      expect(stats.lateCount).toBe(0);
      expect(stats.absentCount).toBe(0);
      expect(stats.pendingCount).toBe(0);
      expect(stats.submissionRate).toBe(0);
      expect(stats.lateRate).toBe(0);
      expect(stats.absentRate).toBe(0);
    });

    it('should correctly categorize each attendance status', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          (submittedCount, lateCount, absentCount, pendingCount) => {
            // Create records with specific statuses
            const records: Attendance[] = [];
            const baseRecord = {
              id: '',
              memberId: '',
              roundId: 1,
              submittedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            for (let i = 0; i < submittedCount; i++) {
              records.push({ ...baseRecord, id: `s${i}`, memberId: `ms${i}`, status: AttendanceStatus.SUBMITTED });
            }
            for (let i = 0; i < lateCount; i++) {
              records.push({ ...baseRecord, id: `l${i}`, memberId: `ml${i}`, status: AttendanceStatus.LATE });
            }
            for (let i = 0; i < absentCount; i++) {
              records.push({ ...baseRecord, id: `a${i}`, memberId: `ma${i}`, status: AttendanceStatus.ABSENT });
            }
            for (let i = 0; i < pendingCount; i++) {
              records.push({ ...baseRecord, id: `p${i}`, memberId: `mp${i}`, status: AttendanceStatus.PENDING });
            }
            
            const stats = calculateRoundStatistics(records);
            
            expect(stats.submittedCount).toBe(submittedCount);
            expect(stats.lateCount).toBe(lateCount);
            expect(stats.absentCount).toBe(absentCount);
            expect(stats.pendingCount).toBe(pendingCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have rates between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.array(attendanceArb, { minLength: 1, maxLength: 50 }),
          (records) => {
            const stats = calculateRoundStatistics(records);
            
            expect(stats.submissionRate).toBeGreaterThanOrEqual(0);
            expect(stats.submissionRate).toBeLessThanOrEqual(100);
            expect(stats.lateRate).toBeGreaterThanOrEqual(0);
            expect(stats.lateRate).toBeLessThanOrEqual(100);
            expect(stats.absentRate).toBeGreaterThanOrEqual(0);
            expect(stats.absentRate).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
