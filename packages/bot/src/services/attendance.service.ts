/**
 * Attendance Service
 * 출석 관리 서비스
 * Requirements: 5.2, 5.3, 5.5, 5.6
 */

import { eq, and } from 'drizzle-orm';
import {
  getDb,
  attendance,
  members,
  MemberStatus,
  AttendanceStatus,
  type Attendance,
  type NewAttendance,
  type AttendanceStatusType,
} from '@blog-study/shared/db';

/**
 * Error codes for attendance operations
 */
export const AttendanceErrorCodes = {
  ATTENDANCE_NOT_FOUND: 'E4001',
  MEMBER_NOT_FOUND: 'E4002',
  ROUND_NOT_FOUND: 'E4003',
  INVALID_STATUS_TRANSITION: 'E4004',
  ATTENDANCE_ALREADY_EXISTS: 'E4005',
} as const;

/**
 * Custom error class for attendance operations
 */
export class AttendanceError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    message?: string
  ) {
    super(message || userMessage);
    this.name = 'AttendanceError';
  }
}

/**
 * Attendance service for managing attendance records
 */
export class AttendanceService {
  private db = getDb();

  /**
   * Create attendance records for all active members for a round
   * Requirements: 5.2 - Create attendance records with pending status for active members
   */
  async createForRound(roundId: number): Promise<Attendance[]> {
    // Get all active members
    const activeMembers = await this.db
      .select()
      .from(members)
      .where(eq(members.status, MemberStatus.ACTIVE));

    if (activeMembers.length === 0) {
      return [];
    }

    // Create attendance records for each active member
    const attendanceRecords: NewAttendance[] = activeMembers.map((member) => ({
      memberId: member.id,
      roundId,
      status: AttendanceStatus.PENDING,
    }));

    // Insert all records (ignore conflicts for idempotency)
    const created: Attendance[] = [];
    for (const record of attendanceRecords) {
      try {
        const [inserted] = await this.db
          .insert(attendance)
          .values(record)
          .onConflictDoNothing()
          .returning();
        if (inserted) {
          created.push(inserted);
        }
      } catch {
        // Skip if already exists
      }
    }

    return created;
  }

  /**
   * Mark attendance as submitted (on-time submission)
   * Requirements: 5.3 - Post collected within round period -> submitted
   */
  async markSubmitted(memberId: string, roundId: number): Promise<Attendance> {
    const existing = await this.getByMemberAndRound(memberId, roundId);
    
    if (!existing) {
      // Create new attendance record if it doesn't exist
      const [created] = await this.db
        .insert(attendance)
        .values({
          memberId,
          roundId,
          status: AttendanceStatus.SUBMITTED,
          submittedAt: new Date(),
        })
        .returning();
      return created!;
    }

    // Only update if current status is pending
    if (existing.status !== AttendanceStatus.PENDING) {
      return existing; // Already submitted, late, or absent
    }

    const [updated] = await this.db
      .update(attendance)
      .set({
        status: AttendanceStatus.SUBMITTED,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(attendance.memberId, memberId),
          eq(attendance.roundId, roundId)
        )
      )
      .returning();

    return updated!;
  }

  /**
   * Mark attendance as late (grace period submission)
   * Requirements: 5.5 - Post collected on grace day -> late
   */
  async markLate(memberId: string, roundId: number): Promise<Attendance> {
    const existing = await this.getByMemberAndRound(memberId, roundId);
    
    if (!existing) {
      // Create new attendance record if it doesn't exist
      const [created] = await this.db
        .insert(attendance)
        .values({
          memberId,
          roundId,
          status: AttendanceStatus.LATE,
          submittedAt: new Date(),
        })
        .returning();
      return created!;
    }

    // Only update if current status is pending
    if (existing.status !== AttendanceStatus.PENDING) {
      return existing; // Already submitted, late, or absent
    }

    const [updated] = await this.db
      .update(attendance)
      .set({
        status: AttendanceStatus.LATE,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(attendance.memberId, memberId),
          eq(attendance.roundId, roundId)
        )
      )
      .returning();

    return updated!;
  }

  /**
   * Mark attendance as absent (no submission after grace period)
   * Requirements: 5.6 - No post after grace period -> absent
   */
  async markAbsent(memberId: string, roundId: number): Promise<Attendance> {
    const existing = await this.getByMemberAndRound(memberId, roundId);
    
    if (!existing) {
      // Create new attendance record if it doesn't exist
      const [created] = await this.db
        .insert(attendance)
        .values({
          memberId,
          roundId,
          status: AttendanceStatus.ABSENT,
        })
        .returning();
      return created!;
    }

    // Only update if current status is pending
    if (existing.status !== AttendanceStatus.PENDING) {
      return existing; // Already submitted, late, or absent
    }

    const [updated] = await this.db
      .update(attendance)
      .set({
        status: AttendanceStatus.ABSENT,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(attendance.memberId, memberId),
          eq(attendance.roundId, roundId)
        )
      )
      .returning();

    return updated!;
  }

  /**
   * Process grace period end - mark all pending as absent
   * Requirements: 5.6 - When grace period ends, pending -> absent
   */
  async processGracePeriodEnd(roundId: number): Promise<Attendance[]> {
    // Get all pending attendance records for the round
    const pendingRecords = await this.db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.roundId, roundId),
          eq(attendance.status, AttendanceStatus.PENDING)
        )
      );

    const updated: Attendance[] = [];
    for (const record of pendingRecords) {
      const result = await this.markAbsent(record.memberId, roundId);
      updated.push(result);
    }

    return updated;
  }

  /**
   * Get attendance record by member and round
   */
  async getByMemberAndRound(memberId: string, roundId: number): Promise<Attendance | null> {
    const [record] = await this.db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.memberId, memberId),
          eq(attendance.roundId, roundId)
        )
      )
      .limit(1);

    return record || null;
  }

  /**
   * Get all attendance records for a round
   */
  async getByRound(roundId: number): Promise<Attendance[]> {
    return this.db
      .select()
      .from(attendance)
      .where(eq(attendance.roundId, roundId));
  }

  /**
   * Get all attendance records for a member
   */
  async getByMember(memberId: string): Promise<Attendance[]> {
    return this.db
      .select()
      .from(attendance)
      .where(eq(attendance.memberId, memberId));
  }

  /**
   * Update attendance status manually (admin function)
   */
  async updateStatus(
    memberId: string,
    roundId: number,
    status: AttendanceStatusType
  ): Promise<Attendance> {
    const existing = await this.getByMemberAndRound(memberId, roundId);
    
    if (!existing) {
      throw new AttendanceError(
        AttendanceErrorCodes.ATTENDANCE_NOT_FOUND,
        '해당 출석 기록을 찾을 수 없습니다.'
      );
    }

    const [updated] = await this.db
      .update(attendance)
      .set({
        status,
        updatedAt: new Date(),
        submittedAt: status === AttendanceStatus.SUBMITTED || status === AttendanceStatus.LATE
          ? new Date()
          : existing.submittedAt,
      })
      .where(
        and(
          eq(attendance.memberId, memberId),
          eq(attendance.roundId, roundId)
        )
      )
      .returning();

    return updated!;
  }

  /**
   * Get current round attendance status for all active members
   */
  async getCurrentRoundStatus(roundId: number): Promise<Array<{
    memberId: string;
    discordId: string;
    discordUsername: string;
    status: AttendanceStatusType;
    submittedAt: Date | null;
  }>> {
    const records = await this.db
      .select({
        memberId: attendance.memberId,
        discordId: members.discordId,
        discordUsername: members.discordUsername,
        status: attendance.status,
        submittedAt: attendance.submittedAt,
      })
      .from(attendance)
      .innerJoin(members, eq(attendance.memberId, members.id))
      .where(
        and(
          eq(attendance.roundId, roundId),
          eq(members.status, MemberStatus.ACTIVE)
        )
      );

    return records.map((r) => ({
      memberId: r.memberId,
      discordId: r.discordId,
      discordUsername: r.discordUsername,
      status: r.status as AttendanceStatusType,
      submittedAt: r.submittedAt,
    }));
  }
}

// Singleton instance
let attendanceServiceInstance: AttendanceService | null = null;

/**
 * Get the AttendanceService singleton instance
 */
export function getAttendanceService(): AttendanceService {
  if (!attendanceServiceInstance) {
    attendanceServiceInstance = new AttendanceService();
  }
  return attendanceServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetAttendanceService(): void {
  attendanceServiceInstance = null;
}
