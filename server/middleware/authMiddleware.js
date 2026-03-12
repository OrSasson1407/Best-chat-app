/**
 * JWT Authentication Middleware
 * -------------------------------------------------------
 * This middleware verifies the short-lived JWT Access Token
 * sent by the client to protect private API routes.
 *
 * Responsibilities:
 * - Extract JWT from cookies (Primary) or request headers (Fallback)
 * - Verify token authenticity and check Redis blacklist
 * - Decode the token payload
 * - Attach user information to the request object
 *
 * Security Notes:
 * - Access tokens are now expected in HttpOnly cookies to prevent XSS.
 * - Token expiration is handled by JWT itself.
 * - If expired, client should call the refresh endpoint.
 */

const jwt = require("jsonwebtoken");

// --- LEVEL 4: REDIS BLACKLIST CHECKING ---
const { createClient } = require("redis");
const cacheClient = createClient({ url: process.env.REDIS_URI || "redis://localhost:6379" });
cacheClient.connect().catch(err => console.warn("Middleware Cache Client Error:", err));


/**
 * Middleware function to verify JWT Access Token
 * CHANGED: Now async to support Redis blacklist checking
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware in the chain
 */
module.exports = async (req, res, next) => {

  /**
   * Step 1: Extract token
   * STEP 4 FIX: Prioritize HttpOnly Cookie, fallback to header for backwards compatibility
   */
  const token = (req.cookies && req.cookies.accessToken) 
    ? req.cookies.accessToken 
    : req.header("x-auth-token");


  /**
   * Step 2: Ensure token exists
   */
  if (!token) {
    return res.status(401).json({
      msg: "No token, authorization denied"
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
                msg: "Token has been revoked. Please log in again." 
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
     * { id: user._id }
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
     * If token invalid or expired
     */
    res.status(401).json({
      msg: "Token is not valid or has expired"
    });

  }

};