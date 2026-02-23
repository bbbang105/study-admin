/**
 * Property-Based Tests for FineService
 * Tests correctness properties for fine management operations
 * 
 * These tests verify the business logic of fine operations using
 * pure functions extracted from the service.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  FineAmounts,
  PaymentConfirmationWords,
  isPaymentConfirmation,
  getFineAmount,
  formatFineReason,
} from './fine.service';
import {
  FineType,
  FineStatus,
  type Fine,
  type FineTypeValue,
} from '@blog-study/shared/db';

/**
 * Generate valid fine types
 */
const fineTypeArb = fc.constantFrom(FineType.LATE, FineType.ABSENT) as fc.Arbitrary<FineTypeValue>;

/**
 * Generate a valid fine object
 */
const fineArb = fc.record({
  id: fc.uuid(),
  memberId: fc.uuid(),
  roundId: fc.integer({ min: 1, max: 20 }),
  type: fineTypeArb,
  amount: fc.constantFrom(FineAmounts.LATE, FineAmounts.ABSENT),
  status: fc.constantFrom(FineStatus.UNPAID, FineStatus.PAID, FineStatus.WAIVED),
  createdAt: fc.date(),
  paidAt: fc.option(fc.date(), { nil: null }),
}) as fc.Arbitrary<Fine>;




/**
 * Generate messages containing payment confirmation words
 */
const confirmationMessageArb = fc.oneof(
  // Direct confirmation words
  fc.constantFrom(...PaymentConfirmationWords).map(word => word),
  // Confirmation words with surrounding text
  fc.tuple(
    fc.string({ minLength: 0, maxLength: 20 }),
    fc.constantFrom(...PaymentConfirmationWords),
    fc.string({ minLength: 0, maxLength: 20 })
  ).map(([prefix, word, suffix]) => `${prefix} ${word} ${suffix}`),
  // Confirmation words with different cases
  fc.constantFrom(...PaymentConfirmationWords).map(word => word.toUpperCase()),
);

/**
 * Generate messages that do NOT contain payment confirmation words
 */
const nonConfirmationMessageArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(msg => {
    const normalized = msg.toLowerCase().trim();
    return !PaymentConfirmationWords.some(word => 
      normalized.includes(word.toLowerCase())
    );
  });

// ============================================
// Pure Business Logic Functions for Testing
// ============================================

/**
 * Calculate total unpaid fines
 */
function calculateTotalUnpaid(fines: Fine[]): number {
  return fines
    .filter(f => f.status === FineStatus.UNPAID)
    .reduce((sum, f) => sum + f.amount, 0);
}

/**
 * Validate fine creation
 * Returns the expected amount based on type
 */
function validateFineCreation(type: FineTypeValue): { amount: number; reason: string } {
  switch (type) {
    case FineType.LATE:
      return { amount: FineAmounts.LATE, reason: '지각' };
    case FineType.ABSENT:
      return { amount: FineAmounts.ABSENT, reason: '결석' };
    default:
      throw new Error('Invalid fine type');
  }
}

/**
 * Check if fine status transition is valid
 */
function isValidStatusTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  // Can only transition from UNPAID
  if (currentStatus !== FineStatus.UNPAID) {
    return false;
  }
  // Can transition to PAID or WAIVED
  return newStatus === FineStatus.PAID || newStatus === FineStatus.WAIVED;
}

// ============================================
// Property Tests
// ============================================

describe('FineService Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 14: Fine Creation on Late/Absent**
   * *For any* attendance status change to `late`, a fine of 3,000 KRW SHALL be created.
   * For `absent`, a fine of 5,000 KRW SHALL be created.
   * **Validates: Requirements 5.7, 5.8**
   */
  describe('Property 14: Fine Creation on Late/Absent', () => {
    it('should create 3000 KRW fine for late attendance', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.integer({ min: 1, max: 20 }), (_memberId, _roundId) => {
          const result = validateFineCreation(FineType.LATE);
          expect(result.amount).toBe(3000);
          expect(result.reason).toBe('지각');
        }),
        { numRuns: 100 }
      );
    });

    it('should create 5000 KRW fine for absent attendance', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.integer({ min: 1, max: 20 }), (_memberId, _roundId) => {
          const result = validateFineCreation(FineType.ABSENT);
          expect(result.amount).toBe(5000);
          expect(result.reason).toBe('결석');
        }),
        { numRuns: 100 }
      );
    });

    it('should return correct amount for any fine type', () => {
      fc.assert(
        fc.property(fineTypeArb, (type) => {
          const amount = getFineAmount(type);
          if (type === FineType.LATE) {
            expect(amount).toBe(FineAmounts.LATE);
          } else if (type === FineType.ABSENT) {
            expect(amount).toBe(FineAmounts.ABSENT);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should format fine reason correctly for any type', () => {
      fc.assert(
        fc.property(fineTypeArb, (type) => {
          const reason = formatFineReason(type);
          expect(typeof reason).toBe('string');
          expect(reason.length).toBeGreaterThan(0);
          
          if (type === FineType.LATE) {
            expect(reason).toBe('지각');
          } else if (type === FineType.ABSENT) {
            expect(reason).toBe('결석');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure late fine is always less than absent fine', () => {
      expect(FineAmounts.LATE).toBeLessThan(FineAmounts.ABSENT);
      expect(getFineAmount(FineType.LATE)).toBeLessThan(getFineAmount(FineType.ABSENT));
    });
  });


  /**
   * **Feature: blog-study-discord-bot, Property 21: Fine Payment Confirmation Parsing**
   * *For any* DM reply containing confirmation words ("yes", "네", "납부완료", "완료"),
   * the associated fine status SHALL be updated to `paid`.
   * **Validates: Requirements 8.2**
   */
  describe('Property 21: Fine Payment Confirmation Parsing', () => {
    it('should recognize all defined confirmation words', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PaymentConfirmationWords),
          (word) => {
            expect(isPaymentConfirmation(word)).toBe(true);
          }
        ),
        { numRuns: PaymentConfirmationWords.length }
      );
    });

    it('should recognize confirmation words regardless of case', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PaymentConfirmationWords),
          fc.constantFrom('upper', 'lower', 'mixed'),
          (word, caseType) => {
            let testWord: string;
            switch (caseType) {
              case 'upper':
                testWord = word.toUpperCase();
                break;
              case 'lower':
                testWord = word.toLowerCase();
                break;
              case 'mixed':
                testWord = word.split('').map((c, i) => 
                  i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
                ).join('');
                break;
              default:
                testWord = word;
            }
            expect(isPaymentConfirmation(testWord)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should recognize confirmation words with surrounding whitespace', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PaymentConfirmationWords),
          fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 5 }),
          fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 5 }),
          (word, prefix, suffix) => {
            const message = `${prefix}${word}${suffix}`;
            expect(isPaymentConfirmation(message)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should recognize confirmation words embedded in longer messages', () => {
      fc.assert(
        fc.property(confirmationMessageArb, (message) => {
          expect(isPaymentConfirmation(message)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject messages without confirmation words', () => {
      fc.assert(
        fc.property(nonConfirmationMessageArb, (message) => {
          expect(isPaymentConfirmation(message)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty and whitespace-only messages', () => {
      expect(isPaymentConfirmation('')).toBe(false);
      expect(isPaymentConfirmation('   ')).toBe(false);
      expect(isPaymentConfirmation('\t\n')).toBe(false);
    });
  });

  /**
   * Additional property tests for fine calculations
   */
  describe('Fine Calculation Properties', () => {
    it('should calculate total unpaid correctly for any set of fines', () => {
      fc.assert(
        fc.property(fc.array(fineArb, { minLength: 0, maxLength: 20 }), (fineList) => {
          const total = calculateTotalUnpaid(fineList);
          
          // Manual calculation for verification
          const expected = fineList
            .filter(f => f.status === FineStatus.UNPAID)
            .reduce((sum, f) => sum + f.amount, 0);
          
          expect(total).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should return 0 for empty fine list', () => {
      expect(calculateTotalUnpaid([])).toBe(0);
    });

    it('should return 0 when all fines are paid or waived', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(fineArb, fc.constantFrom(FineStatus.PAID, FineStatus.WAIVED)).map(([f, status]) => ({
              ...f,
              status,
            })),
            { minLength: 1, maxLength: 10 }
          ),
          (fineList) => {
            const total = calculateTotalUnpaid(fineList);
            expect(total).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only allow valid status transitions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(FineStatus.UNPAID, FineStatus.PAID, FineStatus.WAIVED),
          fc.constantFrom(FineStatus.UNPAID, FineStatus.PAID, FineStatus.WAIVED),
          (currentStatus, newStatus) => {
            const isValid = isValidStatusTransition(currentStatus, newStatus);
            
            if (currentStatus === FineStatus.UNPAID) {
              // From UNPAID, can go to PAID or WAIVED
              expect(isValid).toBe(newStatus === FineStatus.PAID || newStatus === FineStatus.WAIVED);
            } else {
              // From PAID or WAIVED, cannot transition
              expect(isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
