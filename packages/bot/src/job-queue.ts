/**
 * pg-boss Job Queue
 * PostgreSQL 기반 잡 큐 싱글톤 관리
 */

import { PgBoss } from 'pg-boss';
import logger from './lib/logger';

let boss: PgBoss | null = null;

/**
 * Start the pg-boss job queue
 * @param connectionString - Direct PostgreSQL connection string (not pooled)
 */
export async function startJobQueue(connectionString: string): Promise<PgBoss> {
  boss = new PgBoss({
    connectionString,
    // Supabase Session Mode 연결 풀 최적화
    poolSize: 10, // Supabase 무료 플랜 기본 pool size 고려
    applicationName: 'study-admin-bot',
    // 연결 유지 설정
    uuid: 'v1',
    // 연결 관리
    expireCheckInterval: 60, // 1분마다 만료된 잡 체크
    expireCheckSeconds: 3600, // 1시간 후 만료
    // 재시도 설정
    retryBackoff: true,
    retryLimit: 3,
    newJobCheckInterval: 5, // 5초마다 새 잡 체크
    // 연결 풀 관리
    max: 10, // 최대 연결 수
    idleTimeout: 10000, // 10초 유휴 시간 후 연결 반환
    connectionTimeout: 10000, // 10초 연결 타임아웃
  });

  boss.on('error', (error: Error) => logger.error({ error }, '[pg-boss] Error'));
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
