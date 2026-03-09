/**
 * pg-boss Job Queue
 * PostgreSQL 기반 잡 큐 싱글톤 관리
 */

import { PgBoss } from 'pg-boss';

let boss: PgBoss | null = null;

/**
 * Start the pg-boss job queue
 * @param connectionString - Direct PostgreSQL connection string (not pooled)
 */
export async function startJobQueue(connectionString: string): Promise<PgBoss> {
  boss = new PgBoss(connectionString);

  boss.on('error', (error: Error) => console.error('[pg-boss] Error:', error));
  await boss.start();
  console.log('[pg-boss] Started');

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
    console.log('[pg-boss] Stopped');
  }
}
