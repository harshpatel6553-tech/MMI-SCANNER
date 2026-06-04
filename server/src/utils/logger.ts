/**
 * @module logger
 * @description Centralized Winston logger with colorized console output.
 * All modules should import this logger instead of using console.log directly.
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format: [timestamp] [level]: message
 */
const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  const msg = stack || message;
  return `[${ts}] [${level}]: ${msg}`;
});

/**
 * Application-wide Winston logger instance.
 *
 * Features:
 * - Colorized console output for development readability
 * - ISO timestamp on every log entry
 * - Stack trace preservation for Error objects
 * - Log level controlled by NODE_ENV (debug in dev, info in production)
 *
 * @example
 * ```typescript
 * import logger from '../utils/logger.js';
 * logger.info('Server started on port 5000');
 * logger.error('Failed to fetch quote', { symbol: 'RELIANCE.NS' });
 * ```
 */
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
  ],
  exitOnError: false,
});

export default logger;
