// server/middleware/errorMiddleware.js
module.exports.errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    status: false,
    msg: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

// Validation Helper using Joi
const Joi = require("joi");
module.exports.validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400);
    return next(new Error(error.details[0].message));
  }
  next();
};