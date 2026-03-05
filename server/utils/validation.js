const Joi = require("joi");

// Validation for User Registration
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(20).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^[a-zA-Z0-9]{8,30}$')).required()
    .messages({ 'string.pattern.base': 'Password must be 8-30 characters and alphanumeric.' }),
});

// Validation for Login
const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

module.exports = { registerSchema, loginSchema };