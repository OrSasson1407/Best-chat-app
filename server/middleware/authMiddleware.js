/**
 * JWT Authentication Middleware
 * -------------------------------------------------------
 * This middleware verifies the short-lived JWT Access Token
 * sent by the client to protect private API routes.
 *
 * Responsibilities:
 * - Extract JWT from request headers
 * - Verify token authenticity
 * - Decode the token payload
 * - Attach user information to the request object
 *
 * Expected Header:
 *    x-auth-token: <JWT_ACCESS_TOKEN>
 *
 * Typical Flow:
 * 1. Client logs in
 * 2. Server returns Access Token
 * 3. Client sends token with every protected request
 * 4. This middleware validates the token
 * 5. Controllers access user data via req.user
 *
 * Security Notes:
 * - Token expiration is handled by JWT itself
 * - If expired, client should call the refresh endpoint
 */

const jwt = require("jsonwebtoken");


/**
 * Middleware function to verify JWT Access Token
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware in the chain
 */
module.exports = (req, res, next) => {

  /**
   * Step 1: Extract token from request header
   */
  const token = req.header("x-auth-token");


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