/**
 * Logger Utility
 * -------------------------------------------------------
 * This module configures the application's centralized
 * logging system using the Winston logging library.
 *
 * Responsibilities:
 * - Standardize logs across the backend
 * - Write logs to files for monitoring and debugging
 * - Output readable logs in development
 * - Provide structured JSON logs in production
 * - Handle log rotation to prevent infinite file growth (NEW)
 * - Automatically mask sensitive data (NEW)
 *
 * Log Files:
 * logs/error-%DATE%.log    -> Stores only error logs
 * logs/combined-%DATE%.log -> Stores all logs
 *
 * Benefits:
 * - Easier debugging
 * - Production observability
 * - Compatible with logging systems like ELK Stack, Datadog, etc.
 */

const { createLogger, format, transports } = require("winston");
require("winston-daily-rotate-file"); // ADDED: Log rotation plugin

/* =====================================================
   SENSITIVE DATA MASKING (NEW)
   ===================================================== */
/**
 * Automatically detects sensitive keys and replaces their
 * values with "***MASKED***" before writing to log files.
 */
const maskSensitiveData = format((info) => {
  const sensitiveKeys = ['password', 'token', 'publicKey', 'privateKey'];
  const maskStr = '***MASKED***';

  const traverseAndMask = (obj) => {
    for (let key in obj) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        obj[key] = maskStr;
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        traverseAndMask(obj[key]);
      }
    }
  };

  // Mask metadata and info object
  traverseAndMask(info);
  return info;
});


/**
 * Create Winston logger instance
 */
const logger = createLogger({

  /**
   * Logging level
   *
   * production -> only info + warnings + errors
   * development -> include debug logs
   */
  level: process.env.NODE_ENV === "production" ? "info" : "debug",

  /**
   * Log format configuration
   */
  format: format.combine(
    maskSensitiveData(), // ADDED: Mask sensitive fields automatically
    
    /**
     * Adds timestamp to every log entry
     */
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),

    /**
     * Includes stack trace for errors
     */
    format.errors({ stack: true }),

    /**
     * Enables string interpolation
     */
    format.splat(),

    /**
     * Outputs logs as structured JSON
     * Ideal for production logging pipelines
     */
    format.json()
  ),

  /**
   * Default metadata attached to every log
   */
  defaultMeta: { service: "chat-backend" },

  /**
   * Log transports define where logs are written
   */
  transports: [

    /**
     * Error log file (CHANGED: Now using DailyRotateFile)
     * Stores only error-level logs, rotates daily, keeps 14 days
     */
    new transports.DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      zippedArchive: true, // Compress old logs to save space
      maxSize: "20m",      // Max file size before rotating
      maxFiles: "14d"      // Delete logs older than 14 days
    }),

    /**
     * Combined log file (CHANGED: Now using DailyRotateFile)
     * Stores all logs including info/debug, rotates daily
     */
    new transports.DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d"
    }),

  ],
});


/* =====================================================
   DEVELOPMENT CONSOLE LOGGER
   ===================================================== */

/**
 * When running outside production,
 * logs are also printed to the console
 * in a human-readable colored format.
 */
if (process.env.NODE_ENV !== "production") {

  logger.add(
    new transports.Console({

      format: format.combine(

        /**
         * Adds colors to log levels
         */
        format.colorize(),

        /**
         * Custom console output format
         */
        format.printf(({ timestamp, level, message, stack }) => {
          return `${timestamp} ${level}: ${stack || message}`;
        })
      )

    })
  );
}


/**
 * Export logger instance
 */
module.exports = logger;