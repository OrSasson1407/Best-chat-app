/**
 * Authentication Validation Schemas
 * -------------------------------------------------------
 * This module defines request validation schemas using Joi.
 *
 * Responsibilities:
 * - Validate incoming API request data
 * - Prevent malformed or malicious inputs
 * - Ensure consistent data structure
 *
 * Used in:
 *   • User registration
 *   • User login
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
 *
 * Required fields:
 * - username
 * - email
 * - password
 * - gender
 * - avatarImage
 * - publicKey
 */
const registerSchema = Joi.object({

  /**
   * Username validation
   *
   * Requirements:
   * - Minimum length: 3
   * - Maximum length: 20
   */
  username: Joi.string()
    .min(3)
    .max(20)
    .required(),

  /**
   * Email validation
   *
   * Must follow standard email format.
   */
  email: Joi.string()
    .email()
    .required(),

  /**
   * Password validation
   *
   * Requirements:
   * - Minimum length: 8
   * - Maximum length: 30
   *
   * Custom error messages provided
   * to improve frontend user experience.
   */
  password: Joi.string()
    .min(8)
    .max(30)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long.",
      "string.max": "Password cannot exceed 30 characters.",
      "any.required": "Password is required.",
    }),

  /**
   * Gender validation
   *
   * Only two values allowed:
   * - male
   * - female
   */
  gender: Joi.string()
    .valid("male", "female")
    .required(),

  /**
   * Avatar image validation
   *
   * Must be a valid URL.
   * The frontend sends Dicebear avatar URLs.
   */
  avatarImage: Joi.string()
    .uri()
    .required(),

  /**
   * Public encryption key
   *
   * Used for end-to-end encryption.
   * Each user generates their own key pair.
   */
  publicKey: Joi.string()
    .required(),

});


/* =====================================================
   USER LOGIN VALIDATION
   ===================================================== */

/**
 * Schema for validating login requests.
 *
 * Required fields:
 * - username
 * - password
 */
const loginSchema = Joi.object({

  /**
   * Username field
   */
  username: Joi.string()
    .required(),

  /**
   * Password field
   */
  password: Joi.string()
    .required(),

});


/**
 * Export validation schemas
 */
module.exports = {
  registerSchema,
  loginSchema
};