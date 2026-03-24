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
   IMPROVEMENT: CUSTOM APP ERROR CLASS
   ===================================================== */

/**
 * Use this class in your services/controllers to throw expected operational errors.
 * Example: return next(new AppError('User not found', 404));
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Identifies this as an expected error, not a random bug
    Error.captureStackTrace(this, this.constructor);
  }
}

/* =====================================================
   IMPROVEMENT: GLOBAL ASYNC WRAPPER
   ===================================================== */

/**
 * Wraps async controllers to automatically catch unhandled promises
 * and pass them to the global error handler.
 * Completely eliminates the need for try...catch blocks in controllers!
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

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
   * Determine HTTP status code and default variables
   */
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message;
  let isOperational = err.isOperational || false;

  // --- Mongoose / Database Specific Error Handling ---
  
  // 1. Mongoose Bad ObjectId (e.g., searching for a user ID that doesn't exist)
  if (err.name === 'CastError') {
    message = `Resource not found. Invalid: ${err.path}`;
    statusCode = 404;
    isOperational = true;
  }

  // 2. Mongoose Duplicate Key (e.g., trying to register an email that already exists)
  if (err.code === 11000) {
    message = `Duplicate field value entered. Please use another value.`;
    statusCode = 400;
    isOperational = true;
  }

  // 3. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => val.message);
    message = `Invalid input data: ${errors.join('. ')}`;
    statusCode = 400;
    isOperational = true;
  }

  // 4. Custom Error with attached status code (from our Service layers)
  if (err.statusCode) {
      statusCode = err.statusCode;
      isOperational = true; // Treat explicitly passed status codes as operational
  }

  /**
   * Log error details based on severity
   * (Tweaked to ensure consistent structured logging for production observability)
   */
  if (statusCode >= 500 && !isOperational) {
    logger.error(`[CRITICAL ERROR] ${statusCode} - ${err.message}`, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      stack: err.stack
    });
  } else {
    logger.warn(`[Operational Error] ${statusCode} - ${message}`, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
  }

  /**
   * IMPROVEMENT: Environment-Aware Responses
   * Hide detailed stack traces and DB internals in production.
   */
  if (process.env.NODE_ENV === "production") {
    if (isOperational) {
      // Expected error (e.g. wrong password, duplicate email)
      res.status(statusCode).json({
        status: false,
        msg: message
      });
    } else {
      // Programming or unknown bug (e.g. TypeError, DB crash)
      res.status(500).json({
        status: false,
        msg: "Something went wrong on our end. Please try again later."
      });
    }
  } else {
    // Development Mode: Send maximum details for debugging
    res.status(statusCode).json({
      status: false,
      msg: message,
      error: err,
      // Only include stack trace if NOT in production (double checking)
      stack: process.env.NODE_ENV === 'production' ? '🥞 (hidden in production)' : err.stack
    });
  }
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
   * If validation fails, forward to global error handler using AppError
   */
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  /**
   * Continue request lifecycle
   */
  next();

};

// Export the newly added utilities so they can be used across your app
module.exports.AppError = AppError;
module.exports.catchAsync = catchAsync;