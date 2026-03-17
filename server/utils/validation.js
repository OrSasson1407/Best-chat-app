/**
 * Authentication Validation Schemas
 * -------------------------------------------------------
 * This module defines request validation schemas using Joi.
 *
 * Responsibilities:
 * - Validate incoming API request data
 * - Prevent malformed or malicious inputs
 * - Ensure consistent data structure
 * - Enforce password complexity (NEW)
 * - Auto-normalize inputs like email and whitespace (NEW)
 * - Prevent mass-assignment attacks via strict mode (NEW)
 *
 * Used in:
 * • User registration
 * • User login
 *
 * Benefits:
 * - Prevent invalid data from reaching controllers
 * - Improve API reliability
 * - Provide clear validation error messages
 */

const Joi = require("joi");

/* =====================================================
   USER REGISTRATION VALIDATION
   ===================================================== */

/**
 * Schema for validating user registration requests.
 */
const registerSchema = Joi.object({

  /**
   * Username validation
   *
   * Requirements:
   * - Minimum length: 3
   * - Maximum length: 20
   * - Alphanumeric only (no special characters/symbols)
   * - Auto-trimmed
   */
  username: Joi.string()
    .alphanum() // ADDED: Sanitization (letters & numbers only)
    .min(3)
    .max(20)
    .trim() // ADDED: Normalization (removes accidental spaces)
    .required()
    .messages({
      "string.alphanum": "Username must only contain letters and numbers.",
    }),

  /**
   * Email validation
   *
   * Must follow standard email format.
   * Auto-trimmed and converted to lowercase.
   */
  email: Joi.string()
    .email()
    .trim() // ADDED: Normalization
    .lowercase() // ADDED: Normalization (prevents Email@test.com bypassing email@test.com check)
    .required(),

  /**
   * Password validation
   *
   * Requirements:
   * - Minimum length: 8
   * - Maximum length: 30
   * - Must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character
   */
  password: Joi.string()
    .min(8)
    .max(30)
    .pattern(new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])')) // ADDED: Complexity rules
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long.",
      "string.max": "Password cannot exceed 30 characters.",
      "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.", // ADDED: Complexity message
      "any.required": "Password is required.",
    }),

  /**
   * Gender validation
   */
  gender: Joi.string()
    .valid("male", "female")
    .required(),

  /**
   * Avatar image validation
   * * FIXED: Made optional and allowed to be empty/null so the 
   * backend controller can successfully generate a Dicebear fallback.
   */
  avatarImage: Joi.string()
    .uri()
    .allow("", null)
    .optional(),

  /**
   * Full E2EE Pre-Key Bundle (Signal Protocol)
   * FIXED: Replaced publicKey string with the e2eKeys object bundle
   */
  e2eKeys: Joi.object().required(),

}).options({ stripUnknown: true }); // FIXED: Automatically removes fields like 'confirmPassword' instead of crashing


/* =====================================================
   USER LOGIN VALIDATION
   ===================================================== */

/**
 * Schema for validating login requests.
 */
const loginSchema = Joi.object({

  /**
   * Username field
   */
  username: Joi.string()
    .trim() // ADDED: Normalization
    .required(),

  /**
   * Password field
   */
  password: Joi.string()
    .required(),

}).options({ stripUnknown: true }); // FIXED: Strip extra fields instead of failing


/**
 * Export validation schemas
 */
module.exports = {
  registerSchema,
  loginSchema
};