/**
 * Pino Logger Configuration
 * Structured logging for the Blog Study Discord Bot
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Create a pino logger instance
 * - Development: Pretty-printed colored logs to console
 * - Production: JSON logs to stdout (for systemd/journal)
 */
const logger = pino({
  level: isDev ? 'debug' : 'info',
  // Formatters
  formatters: {
    level: (label) => ({ level: label }),
  },
  // ISO 8601 timestamp
  timestamp: pino.stdTimeFunctions.isoTime,
  // Development: pretty print
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:iso',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  }),
});

export default logger;
