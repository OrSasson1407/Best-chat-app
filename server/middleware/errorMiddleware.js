// server/middleware/errorMiddleware.js
const logger = require("../utils/logger"); 
const Joi = require("joi");

// Global Error Handler
module.exports.errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // Log the error centrally with request details
  logger.error(`${statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  if (err.stack) {
    logger.error(err.stack);
  }

  res.status(statusCode).json({
    status: false,
    msg: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

// Validation Helper using Joi
module.exports.validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400);
    return next(new Error(error.details[0].message));
  }
  next();
};