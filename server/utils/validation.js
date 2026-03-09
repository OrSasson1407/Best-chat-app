const Joi = require("joi");

// Validation for User Registration
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(20).required(),
  email: Joi.string().email().required(),
  // Modified password validation to be less restrictive while maintaining security
  password: Joi.string()
    .min(8)
    .max(30)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long.",
      "string.max": "Password cannot exceed 30 characters.",
      "any.required": "Password is required.",
    }),
  // Added gender validation to match the frontend 'Register.jsx' state
  gender: Joi.string().valid("male", "female").required(),
  // Added avatarImage validation to accept the Dicebear URL sent by the frontend
  avatarImage: Joi.string().uri().required(),
  
  // --- FIX: Add publicKey to schema so it passes validation ---
  publicKey: Joi.string().required(),
});

// Validation for Login
const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

module.exports = { registerSchema, loginSchema };