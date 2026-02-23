/**
 * Fine Service
 * 벌금 관리 서비스
 * Requirements: 5.7, 5.8, 8.1, 8.2, 8.3
 */

import { eq, and } from 'drizzle-orm';
import {
  getDb,
  fines,
  members,
  rounds,
  FineType,
  FineStatus,
  type Fine,
  type NewFine,
  type FineTypeValue,
} from '@blog-study/shared/db';

/**
 * Fine amounts in KRW
 */
export const FineAmounts = {
  LATE: 3000,
  ABSENT: 5000,
} as const;

/**
 * Confirmation words for payment (Korean and English)
 */
export const PaymentConfirmationWords = [
  'yes',
  '네',
  '납부완료',
  '완료',
  '확인',
  'paid',
  'done',
] as const;

/**
 * Error codes for fine operations
 */
export const FineErrorCodes = {
  FINE_NOT_FOUND: 'E5001',
  MEMBER_NOT_FOUND: 'E5002',
  ROUND_NOT_FOUND: 'E5003',
  FINE_ALREADY_EXISTS: 'E5004',
  FINE_ALREADY_PAID: 'E5005',
  FINE_ALREADY_WAIVED: 'E5006',
  INVALID_FINE_TYPE: 'E5007',
} as const;

/**
 * Custom error class for fine operations
 */
export class FineError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    message?: string
  ) {
    super(message || userMessage);
    this.name = 'FineError';
  }
}


/**
 * Check if a message contains payment confirmation words
 * Requirements: 8.2 - Parse confirmation words from DM reply
 */
export function isPaymentConfirmation(message: string): boolean {
  const normalizedMessage = message.toLowerCase().trim();
  return PaymentConfirmationWords.some(word => 
    normalizedMessage.includes(word.toLowerCase())
  );
}

/**
 * Get fine amount based on type
 * Requirements: 5.7, 5.8 - Late = 3000, Absent = 5000
 */
export function getFineAmount(type: FineTypeValue): number {
  switch (type) {
    case FineType.LATE:
      return FineAmounts.LATE;
    case FineType.ABSENT:
      return FineAmounts.ABSENT;
    default:
      throw new FineError(
        FineErrorCodes.INVALID_FINE_TYPE,
        '유효하지 않은 벌금 유형입니다.'
      );
  }
}

/**
 * Format fine reason for display
 */
export function formatFineReason(type: FineTypeValue): string {
  switch (type) {
    case FineType.LATE:
      return '지각';
    case FineType.ABSENT:
      return '결석';
    default:
      return '알 수 없음';
  }
}

/**
 * Fine service for managing fines
 */
export class FineService {
  private db = getDb();

  /**
   * Create a fine for a member
   * Requirements: 5.7, 5.8 - Create fine on late/absent
   */
  async create(
    memberId: string,
    roundId: number,
    type: FineTypeValue
  ): Promise<Fine> {
    // Check if fine already exists for this member and round
    const existing = await this.getByMemberAndRound(memberId, roundId);
    if (existing) {
      // Return existing fine instead of creating duplicate
      return existing;
    }

    const amount = getFineAmount(type);

    const newFine: NewFine = {
      memberId,
      roundId,
      type,
      amount,
      status: FineStatus.UNPAID,
    };

    const [created] = await this.db.insert(fines).values(newFine).returning();
    return created!;
  }

  /**
   * Mark a fine as paid
   * Requirements: 8.2 - Update fine status to paid
   */
  async markPaid(fineId: string): Promise<Fine> {
    const existing = await this.getById(fineId);
    if (!existing) {
      throw new FineError(
        FineErrorCodes.FINE_NOT_FOUND,
        '해당 벌금을 찾을 수 없습니다.'
      );
    }

    if (existing.status === FineStatus.PAID) {
      return existing; // Already paid
    }

    const [updated] = await this.db
      .update(fines)
      .set({
        status: FineStatus.PAID,
        paidAt: new Date(),
      })
      .where(eq(fines.id, fineId))
      .returning();

    return updated!;
  }

  /**
   * Mark a fine as waived (admin function)
   * Requirements: 15.7 - Admin can waive fines
   */
  async markWaived(fineId: string): Promise<Fine> {
    const existing = await this.getById(fineId);
    if (!existing) {
      throw new FineError(
        FineErrorCodes.FINE_NOT_FOUND,
        '해당 벌금을 찾을 수 없습니다.'
      );
    }

    if (existing.status === FineStatus.WAIVED) {
      return existing; // Already waived
    }

    const [updated] = await this.db
      .update(fines)
      .set({
        status: FineStatus.WAIVED,
      })
      .where(eq(fines.id, fineId))
      .returning();

    return updated!;
  }


  /**
   * Get all unpaid fines for a member
   * Requirements: 8.5 - Get unpaid fines by member
   */
  async getUnpaidByMember(memberId: string): Promise<Fine[]> {
    return this.db
      .select()
      .from(fines)
      .where(
        and(
          eq(fines.memberId, memberId),
          eq(fines.status, FineStatus.UNPAID)
        )
      );
  }

  /**
   * Get all unpaid fines
   * Requirements: 8.6 - Get all unpaid fines
   */
  async getAllUnpaid(): Promise<Fine[]> {
    return this.db
      .select()
      .from(fines)
      .where(eq(fines.status, FineStatus.UNPAID));
  }

  /**
   * Get all unpaid fines grouped by member with member info
   */
  async getAllUnpaidGroupedByMember(): Promise<Array<{
    memberId: string;
    discordId: string;
    discordUsername: string;
    fines: Fine[];
    totalAmount: number;
  }>> {
    const unpaidFines = await this.db
      .select({
        fine: fines,
        discordId: members.discordId,
        discordUsername: members.discordUsername,
      })
      .from(fines)
      .innerJoin(members, eq(fines.memberId, members.id))
      .where(eq(fines.status, FineStatus.UNPAID));

    // Group by member
    const grouped = new Map<string, {
      memberId: string;
      discordId: string;
      discordUsername: string;
      fines: Fine[];
      totalAmount: number;
    }>();

    for (const row of unpaidFines) {
      const existing = grouped.get(row.fine.memberId);
      if (existing) {
        existing.fines.push(row.fine);
        existing.totalAmount += row.fine.amount;
      } else {
        grouped.set(row.fine.memberId, {
          memberId: row.fine.memberId,
          discordId: row.discordId,
          discordUsername: row.discordUsername,
          fines: [row.fine],
          totalAmount: row.fine.amount,
        });
      }
    }

    return Array.from(grouped.values());
  }

  /**
   * Get fine by ID
   */
  async getById(fineId: string): Promise<Fine | null> {
    const [fine] = await this.db
      .select()
      .from(fines)
      .where(eq(fines.id, fineId))
      .limit(1);

    return fine || null;
  }

  /**
   * Get fine by member and round
   */
  async getByMemberAndRound(memberId: string, roundId: number): Promise<Fine | null> {
    const [fine] = await this.db
      .select()
      .from(fines)
      .where(
        and(
          eq(fines.memberId, memberId),
          eq(fines.roundId, roundId)
        )
      )
      .limit(1);

    return fine || null;
  }

  /**
   * Get all fines for a member
   */
  async getByMember(memberId: string): Promise<Fine[]> {
    return this.db
      .select()
      .from(fines)
      .where(eq(fines.memberId, memberId));
  }

  /**
   * Get total unpaid amount for a member
   */
  async getTotalUnpaidByMember(memberId: string): Promise<number> {
    const unpaidFines = await this.getUnpaidByMember(memberId);
    return unpaidFines.reduce((sum, fine) => sum + fine.amount, 0);
  }

  /**
   * Get fines that need reminders (unpaid for more than 3 days)
   * Requirements: 8.4 - Send reminder every 3 days for unpaid fines
   */
  async getFinesNeedingReminder(daysSinceCreation: number = 3): Promise<Fine[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceCreation);

    const unpaidFines = await this.getAllUnpaid();
    
    // Filter fines created more than daysSinceCreation days ago
    return unpaidFines.filter(fine => {
      const createdAt = fine.createdAt ? new Date(fine.createdAt) : new Date();
      return createdAt <= cutoffDate;
    });
  }

  /**
   * Get fines with member info for sending reminders
   */
  async getFinesWithMemberInfo(): Promise<Array<{
    fine: Fine;
    discordId: string;
    discordUsername: string;
    roundNumber: number;
  }>> {
    const result = await this.db
      .select({
        fine: fines,
        discordId: members.discordId,
        discordUsername: members.discordUsername,
        roundNumber: rounds.roundNumber,
      })
      .from(fines)
      .innerJoin(members, eq(fines.memberId, members.id))
      .innerJoin(rounds, eq(fines.roundId, rounds.id))
      .where(eq(fines.status, FineStatus.UNPAID));

    return result.map(row => ({
      fine: row.fine,
      discordId: row.discordId,
      discordUsername: row.discordUsername,
      roundNumber: row.roundNumber,
    }));
  }

  /**
   * Waive fine by member and round (admin function)
   * Requirements: 15.7 - Admin can waive fines by user and round
   */
  async waiveByMemberAndRound(memberId: string, roundId: number): Promise<Fine | null> {
    const fine = await this.getByMemberAndRound(memberId, roundId);
    if (!fine) {
      return null;
    }
    return this.markWaived(fine.id);
  }
}

// Singleton instance
let fineServiceInstance: FineService | null = null;

/**
 * Get the FineService singleton instance
 */
export function getFineService(): FineService {
  if (!fineServiceInstance) {
    fineServiceInstance = new FineService();
  }
  return fineServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetFineService(): void {
  fineServiceInstance = null;
}
