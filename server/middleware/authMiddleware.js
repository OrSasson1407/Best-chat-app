/**
 * JWT Authentication Middleware
 * -------------------------------------------------------
 * This middleware verifies the short-lived JWT Access Token
 * sent by the client to protect private API routes.
 *
 * Responsibilities:
 * - Extract JWT from request headers (Authorization Bearer or x-auth-token)
 * - Verify token authenticity and check Redis blacklist
 * - Decode the token payload
 * - Attach user information to the request object
 *
 * Security Notes:
 * - Cookies have been REMOVED from this check to allow per-tab user isolation.
 * - Token expiration is handled by JWT itself.
 * - If expired, client should call the refresh endpoint.
 */

const jwt = require("jsonwebtoken");

// --- LEVEL 4: REDIS BLACKLIST CHECKING ---
const { createRedisClient } = require("../config/redis");
const cacheClient = createRedisClient();

// CRITICAL FIX: Attach an error event listener.
// Without this, background Redis timeouts will crash the entire Node.js process (Exit Status 1).
cacheClient.on("error", (err) => {
  console.warn("Redis Cache Client Background Error:", err.message);
});

// LAZY CONNECT FIX: Connect in the background without blocking startup.
// The client will retry automatically on failure — we never await this.
// All usage is guarded by cacheClient.isReady so no requests will fail if Redis is slow to connect.
cacheClient.connect().catch(() => {});

/**
 * Main Middleware function to verify JWT Access Token
 * CHANGED: Now async to support Redis blacklist checking
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware in the chain
 */
const protect = async (req, res, next) => {

  /**
   * Step 1: Extract token
   * CRITICAL FIX: Completely ignore cookies to support strict per-tab user isolation.
   * Rely exclusively on the Authorization Header or x-auth-token.
   */
  let token = req.header("Authorization");
  if (token && token.startsWith("Bearer ")) {
    token = token.replace("Bearer ", "").trim();
  } else {
    // Fallback for older routes using x-auth-token
    token = req.header("x-auth-token");
  }

  /**
   * Step 2: Ensure token exists
   */
  if (!token) {
    return res.status(401).json({
      msg: "No token, authorization denied",
      code: "NO_TOKEN"
    });
  }

  try {

    /**
     * STEP 4 FIX: SECURITY ENHANCEMENT
     * Check if the token was revoked (logged out) and stored in the Redis blacklist
     */
    if (cacheClient.isReady) {
        const isBlacklisted = await cacheClient.get(`bl_${token}`);
        if (isBlacklisted) {
            return res.status(401).json({ 
                msg: "Token has been revoked. Please log in again.",
                code: "TOKEN_REVOKED"
            });
        }
    }

    /**
     * Step 3: Verify the token
     *
     * jwt.verify:
     * - checks signature
     * - checks expiration
     * - returns decoded payload
     */
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    /**
     * Step 4: Attach decoded payload to request
     *
     * Your token structure:
     * { id: user._id, role: user.role }
     *
     * Controllers can now access:
     * req.user.id
     */
    req.user = decoded;

    /**
     * Continue request lifecycle
     */
    next();

  } catch (err) {

    /**
     * IMPROVEMENT: Granular Expiration Handling
     * If token expired, send a specific code so frontend knows to automatically refresh it
     * instead of kicking the user out completely.
     */
    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            msg: "Your session has expired. Please refresh your token.",
            code: "TOKEN_EXPIRED"
        });
    }

    /**
     * If token is generally invalid (bad signature, tampered with)
     */
    return res.status(401).json({
      msg: "Token is not valid",
      code: "TOKEN_INVALID"
    });

  }

};

/**
 * IMPROVEMENT: Role-Based Access Control (RBAC)
 * Higher-order middleware to restrict routes to specific user roles.
 * * Usage example in routes: 
 * router.delete('/group/:id', protect, protect.restrictTo('admin', 'moderator'), deleteGroup)
 */
protect.restrictTo = (...roles) => {
  return (req, res, next) => {
      // Ensure the token payload actually contains a role field and matches allowed roles
      if (!req.user || !roles.includes(req.user.role)) {
          return res.status(403).json({ 
              msg: "You do not have permission to perform this action",
              code: "FORBIDDEN"
          });
      }
      next();
  };
};

// Export the main middleware function
module.exports = protect;