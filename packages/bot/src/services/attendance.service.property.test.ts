/**
 * Property-Based Tests for AttendanceService
 * Tests correctness properties for attendance management operations
 * 
 * These tests verify the business logic of attendance operations using
 * pure functions extracted from the service.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  AttendanceStatus,
  type Attendance,
  type AttendanceStatusType,
} from '@blog-study/shared/db';

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



// ============================================
// Pure Business Logic Functions for Testing
// ============================================

/**
 * Simulates the attendance store
 */
interface AttendanceStore {
  records: Map<string, Attendance>;
}

function createAttendanceStore(): AttendanceStore {
  return { records: new Map() };
}

function getKey(memberId: string, roundId: number): string {
  return `${memberId}:${roundId}`;
}

/**
 * Create attendance record with pending status
 * Requirements: 5.2
 */
function createAttendance(
  store: AttendanceStore,
  memberId: string,
  roundId: number
): Attendance {
  const key = getKey(memberId, roundId);
  const existing = store.records.get(key);
  if (existing) {
    return existing;
  }

  const record: Attendance = {
    id: crypto.randomUUID(),
    memberId,
    roundId,
    status: AttendanceStatus.PENDING,
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  store.records.set(key, record);
  return record;
}

/**
 * Mark attendance as submitted
 * Requirements: 5.3 - Post collected within round period -> submitted
 */
function markSubmitted(
  store: AttendanceStore,
  memberId: string,
  roundId: number
): Attendance {
  const key = getKey(memberId, roundId);
  let record = store.records.get(key);

  if (!record) {
    record = {
      id: crypto.randomUUID(),
      memberId,
      roundId,
      status: AttendanceStatus.SUBMITTED,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.records.set(key, record);
    return record;
  }

  // Only update if current status is pending
  if (record.status !== AttendanceStatus.PENDING) {
    return record;
  }

  const updated: Attendance = {
    ...record,
    status: AttendanceStatus.SUBMITTED,
    submittedAt: new Date(),
    updatedAt: new Date(),
  };
  store.records.set(key, updated);
  return updated;
}

/**
 * Mark attendance as late
 * Requirements: 5.5 - Post collected on grace day -> late
 */
function markLate(
  store: AttendanceStore,
  memberId: string,
  roundId: number
): Attendance {
  const key = getKey(memberId, roundId);
  let record = store.records.get(key);

  if (!record) {
    record = {
      id: crypto.randomUUID(),
      memberId,
      roundId,
      status: AttendanceStatus.LATE,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.records.set(key, record);
    return record;
  }

  // Only update if current status is pending
  if (record.status !== AttendanceStatus.PENDING) {
    return record;
  }

  const updated: Attendance = {
    ...record,
    status: AttendanceStatus.LATE,
    submittedAt: new Date(),
    updatedAt: new Date(),
  };
  store.records.set(key, updated);
  return updated;
}

/**
 * Mark attendance as absent
 * Requirements: 5.6 - No post after grace period -> absent
 */
function markAbsent(
  store: AttendanceStore,
  memberId: string,
  roundId: number
): Attendance {
  const key = getKey(memberId, roundId);
  let record = store.records.get(key);

  if (!record) {
    record = {
      id: crypto.randomUUID(),
      memberId,
      roundId,
      status: AttendanceStatus.ABSENT,
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.records.set(key, record);
    return record;
  }

  // Only update if current status is pending
  if (record.status !== AttendanceStatus.PENDING) {
    return record;
  }

  const updated: Attendance = {
    ...record,
    status: AttendanceStatus.ABSENT,
    updatedAt: new Date(),
  };
  store.records.set(key, updated);
  return updated;
}

/**
 * Determine attendance status based on submission time
 * Requirements: 5.3, 5.5, 5.6
 */
interface RoundPeriod {
  startDate: Date;
  endDate: Date;      // Regular deadline (Sunday 23:59)
  graceEndDate: Date; // Grace period end (Monday 23:59)
}

function determineAttendanceStatus(
  submissionTime: Date | null,
  roundPeriod: RoundPeriod
): AttendanceStatusType {
  if (!submissionTime) {
    return AttendanceStatus.ABSENT;
  }

  // Within regular period (before or on deadline)
  if (submissionTime <= roundPeriod.endDate) {
    return AttendanceStatus.SUBMITTED;
  }

  // Within grace period (after deadline but before grace end)
  if (submissionTime <= roundPeriod.graceEndDate) {
    return AttendanceStatus.LATE;
  }

  // After grace period
  return AttendanceStatus.ABSENT;
}

/**
 * Check if status transition is valid
 * Valid transitions: pending -> submitted, pending -> late, pending -> absent
 * Invalid: any transition from non-pending status
 */
function isValidTransition(
  currentStatus: AttendanceStatusType,
  newStatus: AttendanceStatusType
): boolean {
  // Can only transition from pending
  if (currentStatus !== AttendanceStatus.PENDING) {
    return false;
  }
  // Can transition to any final status
  const validTargetStatuses: AttendanceStatusType[] = [
    AttendanceStatus.SUBMITTED,
    AttendanceStatus.LATE,
    AttendanceStatus.ABSENT,
  ];
  return validTargetStatuses.includes(newStatus);
}

// ============================================
// Property Tests
// ============================================

describe('AttendanceService Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 13: Attendance Status Transitions**
   * *For any* attendance record:
   * - Post collected within round period → status becomes `submitted`
   * - Post collected on grace day → status becomes `late`
   * - No post after grace period → status becomes `absent`
   * **Validates: Requirements 5.3, 5.5, 5.6**
   */
  describe('Property 13: Attendance Status Transitions', () => {
    it('should transition from pending to submitted when post is within deadline', () => {
      fc.assert(
        fc.property(uuidArb, roundIdArb, (memberId, roundId) => {
          const store = createAttendanceStore();
          
          // Create pending attendance
          const created = createAttendance(store, memberId, roundId);
          expect(created.status).toBe(AttendanceStatus.PENDING);
          
          // Mark as submitted
          const submitted = markSubmitted(store, memberId, roundId);
          expect(submitted.status).toBe(AttendanceStatus.SUBMITTED);
          expect(submitted.submittedAt).not.toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should transition from pending to late when post is in grace period', () => {
      fc.assert(
        fc.property(uuidArb, roundIdArb, (memberId, roundId) => {
          const store = createAttendanceStore();
          
          // Create pending attendance
          const created = createAttendance(store, memberId, roundId);
          expect(created.status).toBe(AttendanceStatus.PENDING);
          
          // Mark as late
          const late = markLate(store, memberId, roundId);
          expect(late.status).toBe(AttendanceStatus.LATE);
          expect(late.submittedAt).not.toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should transition from pending to absent when no post after grace period', () => {
      fc.assert(
        fc.property(uuidArb, roundIdArb, (memberId, roundId) => {
          const store = createAttendanceStore();
          
          // Create pending attendance
          const created = createAttendance(store, memberId, roundId);
          expect(created.status).toBe(AttendanceStatus.PENDING);
          
          // Mark as absent
          const absent = markAbsent(store, memberId, roundId);
          expect(absent.status).toBe(AttendanceStatus.ABSENT);
        }),
        { numRuns: 100 }
      );
    });

    it('should not change status once already submitted', () => {
      fc.assert(
        fc.property(uuidArb, roundIdArb, (memberId, roundId) => {
          const store = createAttendanceStore();
          
          // Create and mark as submitted
          createAttendance(store, memberId, roundId);
          markSubmitted(store, memberId, roundId);
          
          // Try to mark as late - should not change
          const afterLate = markLate(store, memberId, roundId);
          expect(afterLate.status).toBe(AttendanceStatus.SUBMITTED);
          
          // Try to mark as absent - should not change
          const afterAbsent = markAbsent(store, memberId, roundId);
          expect(afterAbsent.status).toBe(AttendanceStatus.SUBMITTED);
        }),
        { numRuns: 100 }
      );
    });

    it('should not change status once already late', () => {
      fc.assert(
        fc.property(uuidArb, roundIdArb, (memberId, roundId) => {
          const store = createAttendanceStore();
          
          // Create and mark as late
          createAttendance(store, memberId, roundId);
          markLate(store, memberId, roundId);
          
          // Try to mark as submitted - should not change
          const afterSubmitted = markSubmitted(store, memberId, roundId);
          expect(afterSubmitted.status).toBe(AttendanceStatus.LATE);
          
          // Try to mark as absent - should not change
          const afterAbsent = markAbsent(store, memberId, roundId);
          expect(afterAbsent.status).toBe(AttendanceStatus.LATE);
        }),
        { numRuns: 100 }
      );
    });

    it('should not change status once already absent', () => {
      fc.assert(
        fc.property(uuidArb, roundIdArb, (memberId, roundId) => {
          const store = createAttendanceStore();
          
          // Create and mark as absent
          createAttendance(store, memberId, roundId);
          markAbsent(store, memberId, roundId);
          
          // Try to mark as submitted - should not change
          const afterSubmitted = markSubmitted(store, memberId, roundId);
          expect(afterSubmitted.status).toBe(AttendanceStatus.ABSENT);
          
          // Try to mark as late - should not change
          const afterLate = markLate(store, memberId, roundId);
          expect(afterLate.status).toBe(AttendanceStatus.ABSENT);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly determine status based on submission time', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
          (baseDate) => {
            // Create a round period
            const startDate = new Date(baseDate);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 13); // 2 weeks - 1 day
            endDate.setHours(23, 59, 59, 999);
            
            const graceEndDate = new Date(endDate);
            graceEndDate.setDate(graceEndDate.getDate() + 1); // +1 day for grace
            graceEndDate.setHours(23, 59, 59, 999);
            
            const roundPeriod: RoundPeriod = { startDate, endDate, graceEndDate };
            
            // Test submission within deadline
            const withinDeadline = new Date(endDate);
            withinDeadline.setHours(12, 0, 0, 0);
            expect(determineAttendanceStatus(withinDeadline, roundPeriod)).toBe(
              AttendanceStatus.SUBMITTED
            );
            
            // Test submission in grace period
            const inGracePeriod = new Date(graceEndDate);
            inGracePeriod.setHours(12, 0, 0, 0);
            expect(determineAttendanceStatus(inGracePeriod, roundPeriod)).toBe(
              AttendanceStatus.LATE
            );
            
            // Test no submission
            expect(determineAttendanceStatus(null, roundPeriod)).toBe(
              AttendanceStatus.ABSENT
            );
            
            // Test submission after grace period
            const afterGrace = new Date(graceEndDate);
            afterGrace.setDate(afterGrace.getDate() + 1);
            expect(determineAttendanceStatus(afterGrace, roundPeriod)).toBe(
              AttendanceStatus.ABSENT
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should validate status transitions correctly', () => {
      fc.assert(
        fc.property(attendanceStatusArb, attendanceStatusArb, (from, to) => {
          const isValid = isValidTransition(from, to);
          
          if (from === AttendanceStatus.PENDING) {
            // From pending, can transition to any final status
            const canTransitionTo = 
              to === AttendanceStatus.SUBMITTED ||
              to === AttendanceStatus.LATE ||
              to === AttendanceStatus.ABSENT;
            expect(isValid).toBe(canTransitionTo);
          } else {
            // From any other status, cannot transition
            expect(isValid).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property tests for attendance creation
   */
  describe('Attendance Creation Properties', () => {
    it('should create attendance with pending status', () => {
      fc.assert(
        fc.property(uuidArb, roundIdArb, (memberId, roundId) => {
          const store = createAttendanceStore();
          const created = createAttendance(store, memberId, roundId);
          
          expect(created.memberId).toBe(memberId);
          expect(created.roundId).toBe(roundId);
          expect(created.status).toBe(AttendanceStatus.PENDING);
          expect(created.submittedAt).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should not create duplicate attendance records', () => {
      fc.assert(
        fc.property(uuidArb, roundIdArb, (memberId, roundId) => {
          const store = createAttendanceStore();
          
          const first = createAttendance(store, memberId, roundId);
          const second = createAttendance(store, memberId, roundId);
          
          // Should return the same record
          expect(first.id).toBe(second.id);
          expect(store.records.size).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should create separate records for different members', () => {
      fc.assert(
        fc.property(
          fc.array(uuidArb, { minLength: 2, maxLength: 5 }),
          roundIdArb,
          (memberIds, roundId) => {
            // Ensure unique member IDs
            const uniqueIds = [...new Set(memberIds)];
            fc.pre(uniqueIds.length >= 2);
            
            const store = createAttendanceStore();
            
            for (const memberId of uniqueIds) {
              createAttendance(store, memberId, roundId);
            }
            
            expect(store.records.size).toBe(uniqueIds.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should create separate records for different rounds', () => {
      fc.assert(
        fc.property(
          uuidArb,
          fc.array(roundIdArb, { minLength: 2, maxLength: 5 }),
          (memberId, roundIds) => {
            // Ensure unique round IDs
            const uniqueRounds = [...new Set(roundIds)];
            fc.pre(uniqueRounds.length >= 2);
            
            const store = createAttendanceStore();
            
            for (const roundId of uniqueRounds) {
              createAttendance(store, memberId, roundId);
            }
            
            expect(store.records.size).toBe(uniqueRounds.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
