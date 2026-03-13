/**
 * Test script to verify pino logging works correctly
 */

import logger from './lib/logger';

// Test different log levels
logger.info('Test info log');
logger.info({ foo: 'bar', count: 42 }, 'Test info with data');
logger.warn('Test warning log');
logger.warn({ reason: 'test' }, 'Test warning with data');
logger.error('Test error log');
logger.error(new Error('Test error object'), 'Test error with object');

// Test debug level (only shows in development)
logger.debug('Test debug log');
logger.debug({ detail: 'debug info' }, 'Test debug with data');

console.log('\n✅ Logger test completed. Check output above.');
