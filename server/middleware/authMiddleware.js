const jwt = require("jsonwebtoken");

/**
 * Middleware to verify the short-lived JWT Access Token.
 * This token is expected in the 'x-auth-token' header.
 */
module.exports = (req, res, next) => {
  // 1. Get the token from the header
  const token = req.header("x-auth-token");

  // 2. Check if no token is provided
  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  // 3. Verify the Access Token
  try {
    // Verifies the token using the short-lived secret (JWT_SECRET)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /**
     * Attach the decoded payload to the request object.
     * Based on your new generateTokens function: { id: user._id }
     * This ensures req.user.id is accessible in your controllers.
     */
    req.user = decoded; 
    
    next(); 
  } catch (err) {
    /**
     * If the token is expired or invalid, the client should 
     * call the /api/auth/refresh endpoint to get a new one.
     */
    res.status(401).json({ msg: "Token is not valid or has expired" });
  }
};