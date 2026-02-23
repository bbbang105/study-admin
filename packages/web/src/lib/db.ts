import { db as sharedDb } from '@blog-study/shared';

/**
 * Get database instance for web application
 * Uses the shared database connection from @blog-study/shared
 */
export function db() {
  return sharedDb.getDb();
}

export const getDb = sharedDb.getDb;
