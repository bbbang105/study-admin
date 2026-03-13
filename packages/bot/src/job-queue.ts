/**
 * pg-boss Job Queue
 * PostgreSQL 기반 잡 큐 싱글톤 관리
 */

import { PgBoss } from 'pg-boss';
import logger from './lib/logger';
import { Sentry } from './lib/sentry';

let boss: PgBoss | null = null;

/**
 * Start the pg-boss job queue
 * @param connectionString - Direct PostgreSQL connection string (not pooled)
 */
export async function startJobQueue(connectionString: string): Promise<PgBoss> {
  // Simple connection string - use default pg-boss settings
  boss = new PgBoss(connectionString);

  boss.on('error', (error: Error) => {
    logger.error({ error }, '[pg-boss] Error');
    Sentry.captureException(error);
  });
  await boss.start();
  logger.info('[pg-boss] Started');

  // Wait for pg-boss to initialize tables
  await new Promise(resolve => setTimeout(resolve, 1000));

  return boss;
}

/**
 * Get the running pg-boss instance
 * @throws Error if pg-boss has not been started
 */
export function getJobQueue(): PgBoss {
  if (!boss) throw new Error('pg-boss not started. Call startJobQueue() first.');
  return boss;
}

/**
 * Stop the pg-boss job queue gracefully
 */
export async function stopJobQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 30000 });
    boss = null;
    logger.info('[pg-boss] Stopped');
  }
}
