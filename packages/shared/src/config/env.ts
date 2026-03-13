import { config } from 'dotenv';
import { z } from 'zod';
import { resolve } from 'path';

// Load .env files (first match wins — dotenv doesn't overwrite existing vars)
// Check cwd first, then monorepo root (two levels up from packages/*)
for (const dir of [process.cwd(), resolve(process.cwd(), '../..'), resolve(process.cwd(), '..')]) {
  config({ path: resolve(dir, '.env.local') });
  config({ path: resolve(dir, '.env') });
}

// Discord configuration schema
const discordEnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_GUILD_ID: z.string().min(1, 'DISCORD_GUILD_ID is required'),
  ADMIN_DISCORD_IDS: z
    .string()
    .transform((val) => val.split(',').map((id) => id.trim()))
    .default(''),
});

// Supabase configuration schema
const supabaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

// Application configuration schema
const appEnvSchema = z.object({
  APP_URL: z.string().url('APP_URL must be a valid URL').default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Study configuration schema (optional)
const studyEnvSchema = z.object({
  STUDY_START_DATE: z.string().optional(),
  TOTAL_ROUNDS: z.coerce.number().int().positive().default(10),
  ANNOUNCEMENT_CHANNEL_ID: z.string().optional(),
  CURATION_CHANNEL_ID: z.string().optional(),
  STUDY_ROLE_ID: z.string().optional(),
});

// Combined environment schema
const envSchema = z.object({
  ...discordEnvSchema.shape,
  ...supabaseEnvSchema.shape,
  ...appEnvSchema.shape,
  ...studyEnvSchema.shape,
});

// Partial schema for bot-only usage
const botEnvSchema = z.object({
  ...discordEnvSchema.shape,
  ...supabaseEnvSchema.shape,
  ...appEnvSchema.shape,
  ...studyEnvSchema.shape,
  DATABASE_URL_DIRECT: z.string().min(1, 'DATABASE_URL_DIRECT is required'),
  SENTRY_DSN: z.string().url().optional(), // Sentry DSN for error monitoring (optional)
});

// Partial schema for web-only usage
const webEnvSchema = z.object({
  ...supabaseEnvSchema.shape,
  ...appEnvSchema.shape,
});

export type Env = z.infer<typeof envSchema>;
export type BotEnv = z.infer<typeof botEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

/**
 * Load and validate all environment variables
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`);
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  return result.data;
}

/**
 * Load and validate bot-specific environment variables
 */
export function loadBotEnv(): BotEnv {
  const result = botEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`);
    throw new Error(`Bot environment validation failed:\n${errors.join('\n')}`);
  }

  return result.data;
}

/**
 * Load and validate web-specific environment variables
 */
export function loadWebEnv(): WebEnv {
  const result = webEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`);
    throw new Error(`Web environment validation failed:\n${errors.join('\n')}`);
  }

  return result.data;
}

/**
 * Check if a Discord user ID is an admin
 */
export function isAdmin(discordId: string, adminIds: string[]): boolean {
  return adminIds.includes(discordId);
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

