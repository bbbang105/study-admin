/**
 * Round Service
 * 회차 관리 서비스
 * Requirements: 5.1, 5.4, 15.1, 15.2
 */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { config, getDb, type NewRound, type Round, rounds, } from '@blog-study/shared/db';
import {
  generateAllRoundDates,
  isDeadlinePassed as checkIsDeadlinePassed,
  isGracePeriod as checkIsGracePeriod,
  isGracePeriodEnded as checkIsGracePeriodEnded,
  type RoundDates,
} from '@blog-study/shared/utils';

/**
 * Error codes for round operations
 */
export const RoundErrorCodes = {
  ROUND_NOT_FOUND: 'E2001',
  NO_CURRENT_ROUND: 'E2002',
  INVALID_START_DATE: 'E2003',
  INVALID_TOTAL_ROUNDS: 'E2004',
  STUDY_NOT_STARTED: 'E2005',
  CONFIG_NOT_FOUND: 'E2006',
  ROUNDS_ALREADY_EXIST: 'E2007',
} as const;

/**
 * Custom error class for round operations
 */
export class RoundError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    message?: string
  ) {
    super(message || userMessage);
    this.name = 'RoundError';
  }
}

/**
 * Config keys for study settings
 */
export const ConfigKeys = {
  STUDY_START_DATE: 'study_start_date',
  TOTAL_ROUNDS: 'total_rounds',
  ANNOUNCEMENT_CHANNEL_ID: 'announcement_channel_id',
  NOTICE_CHANNEL_ID: 'notice_channel_id',
  CURATION_CHANNEL_ID: 'curation_channel_id',
  RANKING_CHANNEL_ID: 'ranking_channel_id',
  BOT_LOG_CHANNEL_ID: 'bot_log_channel_id',
} as const;

/**
 * Format date to YYYY-MM-DD string for database storage
 */
function formatDateToString(date: Date): string {
  const result = date.toISOString().split('T')[0];
  if (!result) {
    throw new Error('Invalid date format');
  }
  return result;
}

/**
 * Parse date string from database to Date object
 */
function parseDateString(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z');
}


/**
 * Get the current round based on today's date
 * Requirements: 5.1
 */
export async function getCurrentRound(): Promise<Round> {
  const db = getDb();
  
  // First try to get the round marked as current
  const currentRound = await db
    .select()
    .from(rounds)
    .where(eq(rounds.isCurrent, true))
    .limit(1);
  
  if (currentRound.length > 0 && currentRound[0]) {
    return currentRound[0];
  }
  
  // If no round is marked as current, find by date
  const today = new Date();
  const todayStr = formatDateToString(today);
  
  const roundByDate = await db
    .select()
    .from(rounds)
    .where(
      and(
        lte(rounds.startDate, todayStr),
        gte(rounds.graceEndDate, todayStr)
      )
    )
    .limit(1);
  
  if (roundByDate.length > 0 && roundByDate[0]) {
    return roundByDate[0];
  }
  
  // If still no round found, get the latest round
  const latestRound = await db
    .select()
    .from(rounds)
    .orderBy(desc(rounds.roundNumber))
    .limit(1);
  
  if (latestRound.length === 0 || !latestRound[0]) {
    throw new RoundError(
      RoundErrorCodes.NO_CURRENT_ROUND,
      '현재 진행 중인 회차가 없습니다. 스터디 설정을 확인해주세요.'
    );
  }
  
  return latestRound[0];
}

/**
 * Get round by specific date
 * Requirements: 5.1
 */
export async function getRoundByDate(date: Date): Promise<Round | null> {
  const db = getDb();
  const dateStr = formatDateToString(date);
  
  const result = await db
    .select()
    .from(rounds)
    .where(
      and(
        lte(rounds.startDate, dateStr),
        gte(rounds.graceEndDate, dateStr)
      )
    )
    .limit(1);
  
  return result.length > 0 && result[0] ? result[0] : null;
}

/**
 * Get round by round number
 */
export async function getRoundByNumber(roundNumber: number): Promise<Round | null> {
  const db = getDb();
  
  const result = await db
    .select()
    .from(rounds)
    .where(eq(rounds.roundNumber, roundNumber))
    .limit(1);
  
  return result.length > 0 && result[0] ? result[0] : null;
}

/**
 * Get all rounds
 */
export async function getAllRounds(): Promise<Round[]> {
  const db = getDb();
  
  return db
    .select()
    .from(rounds)
    .orderBy(rounds.roundNumber);
}

/**
 * Create rounds for the study
 * Requirements: 15.1, 15.2
 *
 * @param startDate - Study start date (should be a Monday)
 * @param totalRounds - Total number of rounds to create
 */
export async function createRounds(startDate: Date, totalRounds: number): Promise<Round[]> {
  if (totalRounds < 1 || totalRounds > 52) {
    throw new RoundError(
      RoundErrorCodes.INVALID_TOTAL_ROUNDS,
      '총 회차 수는 1~52 사이여야 합니다.'
    );
  }
  
  const db = getDb();
  
  // Check if rounds already exist
  const existingRounds = await db.select().from(rounds).limit(1);
  if (existingRounds.length > 0) {
    throw new RoundError(
      RoundErrorCodes.ROUNDS_ALREADY_EXIST,
      '이미 회차가 생성되어 있습니다. 기존 회차를 삭제한 후 다시 시도해주세요.'
    );
  }
  
  // Generate all round dates using the utility function
  const roundDatesList = generateAllRoundDates(startDate, totalRounds);
  
  // Prepare round records for insertion
  const roundRecords: NewRound[] = roundDatesList.map((rd, index) => ({
    roundNumber: rd.roundNumber,
    startDate: formatDateToString(rd.startDate),
    endDate: formatDateToString(rd.endDate),
    graceEndDate: formatDateToString(rd.graceEndDate),
    isCurrent: index === 0, // First round is current by default
  }));
  
  // Insert all rounds
  const insertedRounds = await db
    .insert(rounds)
    .values(roundRecords)
    .returning();
  
  // Save config - use sql template for the value in onConflictDoUpdate
  const startDateStr = formatDateToString(startDate);
  const totalRoundsStr = totalRounds.toString();
  
  await db
    .insert(config)
    .values({ key: ConfigKeys.STUDY_START_DATE, value: startDateStr })
    .onConflictDoUpdate({
      target: config.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });
  
  await db
    .insert(config)
    .values({ key: ConfigKeys.TOTAL_ROUNDS, value: totalRoundsStr })
    .onConflictDoUpdate({
      target: config.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });
  
  return insertedRounds;
}

/**
 * Delete all rounds (for re-initialization)
 */
export async function deleteAllRounds(): Promise<void> {
  const db = getDb();
  await db.delete(rounds);
}

/**
 * Update current round marker
 * Sets the specified round as current and unsets all others
 */
export async function setCurrentRound(roundNumber: number): Promise<Round> {
  const db = getDb();
  
  // First, unset all current flags
  await db
    .update(rounds)
    .set({ isCurrent: false })
    .where(eq(rounds.isCurrent, true));
  
  // Set the specified round as current
  const result = await db
    .update(rounds)
    .set({ isCurrent: true })
    .where(eq(rounds.roundNumber, roundNumber))
    .returning();
  
  if (result.length === 0 || !result[0]) {
    throw new RoundError(
      RoundErrorCodes.ROUND_NOT_FOUND,
      `${roundNumber}회차를 찾을 수 없습니다.`
    );
  }
  
  return result[0];
}


/**
 * Check if the round deadline has passed
 * Requirements: 5.4
 */
export function isDeadlinePassed(round: Round, currentDate: Date = new Date()): boolean {
  const roundDates: RoundDates = {
    roundNumber: round.roundNumber,
    startDate: parseDateString(round.startDate),
    endDate: parseDateString(round.endDate),
    graceEndDate: parseDateString(round.graceEndDate),
  };
  // Set endDate to end of day for proper comparison
  roundDates.endDate.setHours(23, 59, 59, 999);
  
  return checkIsDeadlinePassed(roundDates, currentDate);
}

/**
 * Check if currently in grace period
 * Requirements: 5.4
 */
export function isGracePeriod(round: Round, currentDate: Date = new Date()): boolean {
  const roundDates: RoundDates = {
    roundNumber: round.roundNumber,
    startDate: parseDateString(round.startDate),
    endDate: parseDateString(round.endDate),
    graceEndDate: parseDateString(round.graceEndDate),
  };
  // Set times for proper comparison
  roundDates.endDate.setHours(23, 59, 59, 999);
  roundDates.graceEndDate.setHours(23, 59, 59, 999);
  
  return checkIsGracePeriod(roundDates, currentDate);
}

/**
 * Check if grace period has ended
 */
export function isGracePeriodEnded(round: Round, currentDate: Date = new Date()): boolean {
  const roundDates: RoundDates = {
    roundNumber: round.roundNumber,
    startDate: parseDateString(round.startDate),
    endDate: parseDateString(round.endDate),
    graceEndDate: parseDateString(round.graceEndDate),
  };
  roundDates.graceEndDate.setHours(23, 59, 59, 999);

  return checkIsGracePeriodEnded(roundDates, currentDate);
}

/**
 * Get config value by key
 */
export async function getConfigValue(key: string): Promise<string | null> {
  const db = getDb();
  
  const result = await db
    .select()
    .from(config)
    .where(eq(config.key, key))
    .limit(1);
  
  return result.length > 0 && result[0] ? result[0].value : null;
}

/**
 * Set config value
 */
export async function setConfigValue(key: string, value: string): Promise<void> {
  const db = getDb();
  
  await db
    .insert(config)
    .values({ key, value })
    .onConflictDoUpdate({
      target: config.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });
}

/**
 * Get study start date from config
 */
export async function getStudyStartDate(): Promise<Date | null> {
  const value = await getConfigValue(ConfigKeys.STUDY_START_DATE);
  return value ? parseDateString(value) : null;
}

/**
 * Get total rounds from config
 */
export async function getTotalRounds(): Promise<number | null> {
  const value = await getConfigValue(ConfigKeys.TOTAL_ROUNDS);
  return value ? parseInt(value, 10) : null;
}