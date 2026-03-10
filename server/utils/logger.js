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
 *
 * Log Files:
 *   logs/error.log     -> Stores only error logs
 *   logs/combined.log  -> Stores all logs
 *
 * Benefits:
 * - Easier debugging
 * - Production observability
 * - Compatible with logging systems like:
 *      • ELK Stack
 *      • Datadog
 *      • Grafana
 *      • CloudWatch
 */

const { createLogger, format, transports } = require("winston");


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
     * Error log file
     * Stores only error-level logs
     */
    new transports.File({
      filename: "logs/error.log",
      level: "error"
    }),

    /**
     * Combined log file
     * Stores all logs including info/debug
     */
    new transports.File({
      filename: "logs/combined.log"
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
 *
 * Example usage:
 *
 * const logger = require("../utils/logger");
 *
 * logger.info("Server started");
 * logger.error("Database connection failed");
 * logger.debug("User login attempt");
 */
module.exports = logger;