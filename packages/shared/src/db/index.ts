import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Re-export all schema definitions
export * from './schema';

// Database connection singleton
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let client: ReturnType<typeof postgres> | null = null;

/**
 * Get or create database connection
 * @param connectionString - PostgreSQL connection string (defaults to DATABASE_URL env var)
 */
export function getDb(connectionString?: string) {
  if (db) {
    return db;
  }

  const connStr = connectionString || process.env.DATABASE_URL;

  if (!connStr) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  client = postgres(connStr, {
    max: 10, // Maximum number of connections
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 10, // Connection timeout in seconds
  });

  db = drizzle(client, { schema });

  return db;
}

/**
 * Close database connection
 * Useful for graceful shutdown
 */
export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

/**
 * Get database client for raw queries
 */
export function getClient() {
  if (!client) {
    throw new Error('Database not initialized. Call getDb() first.');
  }
  return client;
}

// Export the schema object for use with drizzle
export { schema };
