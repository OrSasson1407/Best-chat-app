/**
 * Authentication & Socket Validation Schemas
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
 * - Validate real-time Socket.io payloads (NEW)
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
   */
  email: Joi.string()
    .email()
    .trim() // ADDED: Normalization
    .lowercase() // ADDED: Normalization
    .required(),

  /**
   * Password validation
   */
  password: Joi.string()
    .min(8)
    .max(30)
    .pattern(new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])')) // ADDED: Complexity rules
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long.",
      "string.max": "Password cannot exceed 30 characters.",
      "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
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
   */
  avatarImage: Joi.string()
    .uri()
    .allow("", null)
    .optional(),

  /**
   * Full E2EE Pre-Key Bundle (Signal Protocol)
   */
  e2eKeys: Joi.object().required(),

}).options({ stripUnknown: true });


/* =====================================================
   USER LOGIN VALIDATION
   ===================================================== */

/**
 * Schema for validating login requests.
 */
const loginSchema = Joi.object({
  username: Joi.string()
    .trim() // ADDED: Normalization
    .required(),
  password: Joi.string()
    .required(),
}).options({ stripUnknown: true });


/* =====================================================
   SOCKET EVENT VALIDATION SCHEMAS
   ===================================================== */

const sendMsgSchema = Joi.object({
  id: Joi.string().required(),
  localId: Joi.string().optional(),
  msg: Joi.string().allow('', null).optional(),
  from: Joi.string().required(),
  to: Joi.string().required(),
  isGroup: Joi.boolean().default(false),
  type: Joi.string().valid('text', 'image', 'video', 'file', 'audio').default('text'),
  username: Joi.string().optional(),
  replyTo: Joi.object().optional().allow(null),
  pollData: Joi.object().optional().allow(null),
  linkMetadata: Joi.object().optional().allow(null),
  isForwarded: Joi.boolean().optional(),
  isViewOnce: Joi.boolean().optional(),
  fileMetadata: Joi.object().optional().allow(null)
}).options({ stripUnknown: true });

const deliveryReceiptSchema = Joi.object({
  messageId: Joi.string().required(),
  from: Joi.string().required(),
  to: Joi.string().required(),
  isGroup: Joi.boolean().default(false)
}).options({ stripUnknown: true });

// FIX: Schema was mismatched with the frontend payload.
// Frontend sends: { messageId, reactions (array), to, isGroup }
// Old schema required: { from, reaction (string) } — both wrong field names.
// 'from' is not sent (unnecessary for routing), 'reaction' -> 'reactions' (full updated array).
const reactionSchema = Joi.object({
  messageId: Joi.string().required(),
  to: Joi.string().required(),
  isGroup: Joi.boolean().default(false),
  reactions: Joi.array().required()
}).options({ stripUnknown: true });

const markReadSchema = Joi.object({
  messageId: Joi.string().required(),
  from: Joi.string().required(),
  to: Joi.string().required(),
  isGroup: Joi.boolean().default(false),
  username: Joi.string().optional()
}).options({ stripUnknown: true });

const deleteMsgSchema = Joi.object({
  messageId: Joi.string().required(),
  to: Joi.string().required(),
  isGroup: Joi.boolean().default(false)
}).options({ stripUnknown: true });

const editMsgSchema = Joi.object({
  messageId: Joi.string().required(),
  to: Joi.string().required(),
  isGroup: Joi.boolean().default(false),
  newText: Joi.string().required()
}).options({ stripUnknown: true });

const typingSchema = Joi.object({
  from: Joi.string().required(),
  to: Joi.string().required(),
  isGroup: Joi.boolean().default(false),
  isTyping: Joi.boolean().required(),
  username: Joi.string().optional()
}).options({ stripUnknown: true });


/**
 * Export validation schemas
 */
module.exports = {
  registerSchema,
  loginSchema,
  sendMsgSchema,
  deliveryReceiptSchema,
  reactionSchema,
  markReadSchema,
  deleteMsgSchema,
  editMsgSchema,
  typingSchema
};