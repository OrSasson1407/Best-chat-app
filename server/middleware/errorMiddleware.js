/**
 * Global Error Handling Middleware
 * -------------------------------------------------------
 * Centralized error handler for the entire Express application.
 *
 * Responsibilities:
 * - Capture errors thrown in routes/controllers
 * - Log errors using the centralized logger
 * - Send standardized JSON error responses
 * - Hide stack traces in production
 * - Automatically format Mongoose/MongoDB errors
 *
 * Benefits:
 * - Prevents server crashes
 * - Ensures consistent error responses
 * - Improves observability
 */

const logger = require("../utils/logger");
const Joi = require("joi");

/* =====================================================
   GLOBAL ERROR HANDLER
   ===================================================== */

/**
 * Express error-handling middleware
 *
 * Signature with 4 parameters is required by Express
 * to recognize it as an error handler.
 *
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware
 */
module.exports.errorHandler = (err, req, res, next) => {

  /**
   * Determine HTTP status code
   * Default to 500 (Internal Server Error) if not set
   */
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // --- Mongoose / Database Specific Error Handling ---
  
  // 1. Mongoose Bad ObjectId (e.g., searching for a user ID that doesn't exist)
  if (err.name === 'CastError') {
    message = `Resource not found. Invalid: ${err.path}`;
    statusCode = 404;
  }

  // 2. Mongoose Duplicate Key (e.g., trying to register an email that already exists)
  if (err.code === 11000) {
    message = `Duplicate field value entered.`;
    statusCode = 400;
  }

  // 3. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => val.message);
    message = `Invalid input data: ${errors.join('. ')}`;
    statusCode = 400;
  }

  // 4. Custom Error with attached status code (from our Service layers)
  if (err.statusCode) {
      statusCode = err.statusCode;
  }

  /**
   * Log error details
   */
  logger.error(
    `${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );

  /**
   * Log stack trace for debugging
   */
  if (err.stack) {
    logger.error(err.stack);
  }

  /**
   * Send structured JSON error response
   */
  res.status(statusCode).json({
    status: false,
    msg: message,
    /**
     * Hide stack traces in production
     */
    stack: process.env.NODE_ENV === "production" ? null : err.stack
  });

};

/* =====================================================
   REQUEST VALIDATION MIDDLEWARE
   ===================================================== */

/**
 * Middleware factory for validating request bodies
 * using Joi schemas.
 *
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
module.exports.validateRequest = (schema) => (req, res, next) => {

  /**
   * Validate request body against schema
   */
  const { error } = schema.validate(req.body);

  /**
   * If validation fails
   */
  if (error) {
    res.status(400);
    return next(new Error(error.details[0].message));
  }

  /**
   * Continue request lifecycle
   */
  next();

};