/**
 * Manual Trigger API Types
 * Types for manual bot operation triggers and results
 */

import type {
  PollingCycleResult,
  AttendanceCheckResult,
  FineReminderResult,
  RoundReportResult,
  CurationCycleResult,
} from '../schedulers';

// Weekly ranking result type (re-export from scheduler)
export type { WeeklyRankingResult } from '../schedulers/weekly-ranking';

// Curation share result type (re-export from scheduler)
export type { ShareResult as CurationShareResult } from '../schedulers/curation-crawler';

/**
 * Operation status
 */
export type OperationStatus = 'idle' | 'running' | 'completed' | 'error';

/**
 * Operation metadata
 */
export interface OperationInfo {
  id: string;
  name: string;
  description: string;
  category: 'polling' | 'attendance' | 'fine' | 'round' | 'curation' | 'ranking';
  status: OperationStatus;
  lastRun?: Date;
  lastResult?: OperationResult;
}

/**
 * Union type for all operation results
 */
export type OperationResult =
  | PollingCycleResult
  | AttendanceCheckResult
  | FineReminderResult
  | RoundReportResult
  | CurationCycleResult
  | WeeklyRankingResult
  | CurationShareResult;

/**
 * Map of operation IDs to their status
 */
export interface OperationStatusMap {
  'rss-poll': OperationStatus;
  'attendance-check': OperationStatus;
  'fine-reminder': OperationStatus;
  'round-report': OperationStatus;
  'round-start': OperationStatus;
  'curation-crawl': OperationStatus;
  'curation-share': OperationStatus;
  'weekly-ranking': OperationStatus;
}

/**
 * SSE event types for operation streaming
 */
export interface OperationStartEvent {
  type: 'start';
  timestamp: string;
  operation: string;
}

export interface OperationProgressEvent {
  type: 'progress';
  current: number;
  total: number;
  message: string;
}

export interface OperationResultEvent {
  type: 'result';
  data: OperationResult;
}

export interface OperationCompleteEvent {
  type: 'complete';
  duration: number;
  result: OperationResult;
}

export interface OperationErrorEvent {
  type: 'error';
  error: string;
  code: string;
}

export type OperationSSEEvent =
  | OperationStartEvent
  | OperationProgressEvent
  | OperationResultEvent
  | OperationCompleteEvent
  | OperationErrorEvent;

/**
 * Error codes for operation failures
 */
export enum OperationErrorCode {
  ALREADY_RUNNING = 'ALREADY_RUNNING',
  DISCORD_CLIENT_NOT_SET = 'DISCORD_CLIENT_NOT_SET',
  ROUND_NOT_FOUND = 'ROUND_NOT_FOUND',
  GRACE_PERIOD_NOT_ENDED = 'GRACE_PERIOD_NOT_ENDED',
  CHANNEL_NOT_CONFIGURED = 'CHANNEL_NOT_CONFIGURED',
  NO_CONTENT_AVAILABLE = 'NO_CONTENT_AVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
