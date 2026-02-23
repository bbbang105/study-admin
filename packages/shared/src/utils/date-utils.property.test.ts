/**
 * Property-Based Tests for Date Utilities
 * **Feature: blog-study-discord-bot, Property 11: Round Date Calculation**
 * **Validates: Requirements 5.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateRoundDates,
  validateRoundDuration,
  validateRoundStartsOnMonday,
  validateRoundEndsOnSunday,
  isMonday,
  isSunday,
  getRoundNumberByDate,
  determineAttendanceStatus,
  isGracePeriod,
  isDeadlinePassed,
  isGracePeriodEnded,
  generateAllRoundDates,
} from './date-utils';

// 월요일 날짜 생성 arbitrary
const mondayArbitrary = fc.date({
  min: new Date('2020-01-06'), // 월요일
  max: new Date('2030-12-30'),
}).map(date => {
  // 가장 가까운 월요일로 조정
  const day = date.getDay();
  const daysToMonday = day === 0 ? 1 : (day === 1 ? 0 : 8 - day);
  const monday = new Date(date);
  monday.setDate(monday.getDate() + daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
});

// 회차 번호 arbitrary (1-100)
const roundNumberArbitrary = fc.integer({ min: 1, max: 100 });

describe('Date Utils Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 11: Round Date Calculation**
   * *For any* study start date and round number, the round SHALL span exactly 2 weeks
   * from Monday 00:00 to the following Sunday 23:59, with grace period ending Monday 23:59.
   * **Validates: Requirements 5.1**
   */
  describe('Property 11: Round Date Calculation', () => {
    it('should always start on Monday', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            expect(validateRoundStartsOnMonday(roundDates)).toBe(true);
            expect(isMonday(roundDates.startDate)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always end on Sunday', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            expect(validateRoundEndsOnSunday(roundDates)).toBe(true);
            expect(isSunday(roundDates.endDate)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should span exactly 2 weeks (14 days)', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            expect(validateRoundDuration(roundDates)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have grace period end on Monday 23:59', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            // Grace end should be Monday (day after Sunday end)
            expect(isMonday(roundDates.graceEndDate)).toBe(true);
            // Should be at 23:59
            expect(roundDates.graceEndDate.getHours()).toBe(23);
            expect(roundDates.graceEndDate.getMinutes()).toBe(59);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consecutive rounds without gaps', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          fc.integer({ min: 1, max: 50 }),
          (startDate, roundNumber) => {
            const round1 = calculateRoundDates(startDate, roundNumber);
            const round2 = calculateRoundDates(startDate, roundNumber + 1);
            
            // Round 2 should start exactly 2 weeks after Round 1
            const expectedStart = new Date(round1.startDate);
            expectedStart.setDate(expectedStart.getDate() + 14);
            
            expect(round2.startDate.getTime()).toBe(expectedStart.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify round number from any date within round', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          fc.integer({ min: 0, max: 13 }), // day offset within round
          (startDate, roundNumber, dayOffset) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            const testDate = new Date(roundDates.startDate);
            testDate.setDate(testDate.getDate() + dayOffset);
            
            const detectedRound = getRoundNumberByDate(startDate, testDate);
            expect(detectedRound).toBe(roundNumber);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Attendance Status Determination', () => {
    it('should mark as submitted when post is within round period', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          fc.integer({ min: 0, max: 13 }), // day within round
          (startDate, roundNumber, dayOffset) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            const submissionDate = new Date(roundDates.startDate);
            submissionDate.setDate(submissionDate.getDate() + dayOffset);
            submissionDate.setHours(12, 0, 0, 0); // noon
            
            const status = determineAttendanceStatus(roundDates, submissionDate);
            expect(status).toBe('submitted');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark as late when post is in grace period', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            // Submit on grace day (Monday after deadline)
            const submissionDate = new Date(roundDates.graceEndDate);
            submissionDate.setHours(12, 0, 0, 0); // noon on grace day
            
            const status = determineAttendanceStatus(roundDates, submissionDate);
            expect(status).toBe('late');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark as absent when post is after grace period', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            // Submit after grace period
            const submissionDate = new Date(roundDates.graceEndDate);
            submissionDate.setDate(submissionDate.getDate() + 1);
            
            const status = determineAttendanceStatus(roundDates, submissionDate);
            expect(status).toBe('absent');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark as pending when no submission', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            const status = determineAttendanceStatus(roundDates, null);
            expect(status).toBe('pending');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Period Detection', () => {
    it('should correctly identify deadline passed', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            
            // Before deadline
            const beforeDeadline = new Date(roundDates.endDate);
            beforeDeadline.setHours(beforeDeadline.getHours() - 1);
            expect(isDeadlinePassed(roundDates, beforeDeadline)).toBe(false);
            
            // After deadline
            const afterDeadline = new Date(roundDates.endDate);
            afterDeadline.setDate(afterDeadline.getDate() + 1);
            expect(isDeadlinePassed(roundDates, afterDeadline)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify grace period', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            
            // During grace period (Monday noon)
            const duringGrace = new Date(roundDates.graceEndDate);
            duringGrace.setHours(12, 0, 0, 0);
            expect(isGracePeriod(roundDates, duringGrace)).toBe(true);
            
            // Before grace period (during round)
            const beforeGrace = new Date(roundDates.endDate);
            beforeGrace.setHours(beforeGrace.getHours() - 1);
            expect(isGracePeriod(roundDates, beforeGrace)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify grace period ended', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          roundNumberArbitrary,
          (startDate, roundNumber) => {
            const roundDates = calculateRoundDates(startDate, roundNumber);
            
            // After grace period
            const afterGrace = new Date(roundDates.graceEndDate);
            afterGrace.setDate(afterGrace.getDate() + 1);
            expect(isGracePeriodEnded(roundDates, afterGrace)).toBe(true);
            
            // During grace period
            const duringGrace = new Date(roundDates.graceEndDate);
            duringGrace.setHours(12, 0, 0, 0);
            expect(isGracePeriodEnded(roundDates, duringGrace)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Generate All Rounds', () => {
    it('should generate correct number of rounds', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          fc.integer({ min: 1, max: 20 }),
          (startDate, totalRounds) => {
            const rounds = generateAllRoundDates(startDate, totalRounds);
            expect(rounds.length).toBe(totalRounds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have all rounds with correct round numbers', () => {
      fc.assert(
        fc.property(
          mondayArbitrary,
          fc.integer({ min: 1, max: 20 }),
          (startDate, totalRounds) => {
            const rounds = generateAllRoundDates(startDate, totalRounds);
            rounds.forEach((round, index) => {
              expect(round.roundNumber).toBe(index + 1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
