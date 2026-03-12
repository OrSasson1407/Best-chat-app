/**
 * Main Application Entry Point
 * ----------------------------------------
 * This file initializes and configures the entire backend server.
 * It sets up:
 * - Environment variables
 * - Express server
 * - Security middleware
 * - Rate limiting
 * - API routes
 * - Swagger documentation
 * - MongoDB connection
 * - Socket.io real-time communication
 * - Redis adapter for horizontal scaling
 * - Background workers
 * - Global error handling
 * - Graceful shutdown
 *
 * This acts as the **central orchestrator** of the backend system.
 */

require("dotenv").config(); // Load environment variables from .env file

// --- CORE FRAMEWORK IMPORTS ---
const express = require("express"); // Web framework for Node.js
const http = require("http"); // Required for integrating Socket.io with Express
const cors = require("cors"); // Cross-Origin Resource Sharing
const helmet = require("helmet"); // Security middleware to protect HTTP headers
const socket = require("socket.io"); // Real-time WebSocket library
const rateLimit = require("express-rate-limit"); // Prevents API abuse
const cookieParser = require("cookie-parser"); // Parses cookies from requests
const jwt = require("jsonwebtoken"); // Used for authentication tokens

// --- OBSERVABILITY & CONFIGURATION ---
const logger = require("./utils/logger"); // Centralized logging system
const swaggerUi = require("swagger-ui-express"); // Swagger UI for API documentation
const swaggerDocs = require("./config/swagger"); // Swagger specification
const connectDB = require("./config/db"); // MongoDB connection function

// --- SCALABILITY & ROUTES ---
const { createClient } = require("redis"); // Redis client
const { createAdapter } = require("@socket.io/redis-adapter"); // Allows Socket.io to scale across multiple servers

// --- API ROUTES ---
const aiRoutes = require("./routes/aiRoutes");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const groupRoutes = require("./routes/groupRoutes");
const storyRoutes = require("./routes/storyRoutes"); // Feature similar to "stories" in messaging apps

// --- MIDDLEWARE ---
const { errorHandler } = require("./middleware/errorMiddleware"); // Global error handler
const verifyToken = require("./middleware/authMiddleware"); // JWT authentication middleware

// --- SOCKET HANDLERS ---
const socketHandler = require("./socket/socketHandler"); // Contains socket event logic

// --- BACKGROUND WORKERS ---
const startMessageScheduler = require("./workers/messageScheduler"); 
// Worker responsible for handling scheduled messages (send later feature)

// --- EXPRESS APPLICATION INITIALIZATION ---
const app = express();

// Create HTTP server explicitly to attach Socket.io
const server = http.createServer(app);


/* =========================================================
   MIDDLEWARE & SECURITY CONFIGURATION
   ========================================================= */

/**
 * Helmet helps secure Express apps by setting various HTTP headers.
 * Protects against:
 * - XSS attacks
 * - Clickjacking
 * - MIME sniffing
 * - Other common vulnerabilities
 */
app.use(helmet());

/**
 * CORS configuration
 * Allows frontend client to communicate with backend.
 * credentials:true allows cookies / authentication headers.
 */
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));

/**
 * Cookie parser middleware
 * Extracts cookies from incoming requests.
 */
app.use(cookieParser());

/**
 * JSON body parser
 * Allows API to accept JSON payloads.
 * Increased limit to support images, files, etc.
 */
app.use(express.json({ limit: "50mb" }));

/**
 * URL encoded body parser
 */
app.use(express.urlencoded({ limit: "50mb", extended: true }));


/* =========================================================
   RATE LIMITING
   ========================================================= */

/**
 * Rate limiter for authentication endpoints
 *
 * Prevents brute-force login attempts and API abuse.
 *
 * Configurable via environment variables:
 * RATE_LIMIT_WINDOW_MS
 * RATE_LIMIT_MAX
 */
const authLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  message: "Too many requests, please try again later."
});


/* =========================================================
   SWAGGER DOCUMENTATION
   ========================================================= */

/**
 * API documentation available at:
 * http://localhost:PORT/api-docs
 */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


/* =========================================================
   API ROUTES
   ========================================================= */

/**
 * Apply rate limiting specifically to authentication endpoints
 */
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

/**
 * Authentication routes
 * Handles:
 * - login
 * - register
 * - logout
 * - profile updates
 */
app.use("/api/auth", authRoutes);

/**
 * Message routes
 * Protected by JWT authentication middleware
 */
app.use("/api/messages", verifyToken, messageRoutes);

/**
 * Group chat routes
 */
app.use("/api/groups", verifyToken, groupRoutes);

/**
 * Story routes
 * Similar to temporary posts that disappear after a period
 */
app.use("/api/stories", storyRoutes);

/**
 * Health check route
 * Used by load balancers / monitoring systems
 */
app.use("/health", require("./routes/healthRoute"));

/**
 * AI related endpoints
 */
app.use("/api/ai", aiRoutes);


/* =========================================================
   GLOBAL ERROR HANDLER
   ========================================================= */

/**
 * Catch all unhandled errors from routes or middleware
 */
app.use(errorHandler);


/* =========================================================
   DATABASE CONNECTION
   ========================================================= */

/**
 * Establish connection to MongoDB
 */
connectDB();


/* =========================================================
   SOCKET.IO INITIALIZATION
   ========================================================= */

/**
 * Initialize Socket.io server
 * Enables real-time features such as:
 * - Live chat
 * - Typing indicators
 * - Message delivery
 * - Notifications
 */
const io = socket(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  },
});

/**
 * Attach Socket.io instance to Express
 * This allows access inside routes via:
 *
 * req.app.get("io")
 */
app.set("io", io);

/**
 * Legacy global reference for backwards compatibility
 * (Recommended to migrate to req.app.get("io"))
 */
global.chatSocket = io;


/* =========================================================
   REDIS ADAPTER (SCALABILITY)
   ========================================================= */

/**
 * Redis enables horizontal scaling for Socket.io.
 *
 * Without Redis:
 * sockets only work on one server instance.
 *
 * With Redis:
 * multiple backend servers can share socket events.
 */
const pubClient = createClient({
  url: process.env.REDIS_URI || "redis://localhost:6379"
});

const subClient = pubClient.duplicate();

/**
 * Connect Redis clients and attach adapter
 */
Promise.all([pubClient.connect(), subClient.connect()])
.then(() => {

  io.adapter(createAdapter(pubClient, subClient));

  logger.info("Redis Adapter connected to Socket.io");


  /* =========================================================
     SOCKET AUTHENTICATION
     ========================================================= */

  /**
   * Middleware that runs before a socket connection is accepted.
   * Validates JWT token sent from the client.
   */
  io.use((socket, next) => {

    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

      if (err) {
        return next(new Error("Authentication error: Invalid token"));
      }

      // Attach authenticated user ID to socket instance
      socket.userId = decoded.id;

      next();
    });

  });


  /* =========================================================
     SOCKET EVENT HANDLERS
     ========================================================= */

  /**
   * Delegates all socket event logic to dedicated handler
   * CHANGED: Now passing the Redis pubClient to manage distributed state
   */
  socketHandler(io, pubClient);


  /* =========================================================
     BACKGROUND WORKERS
     ========================================================= */

  /**
   * Start scheduled message worker
   * Responsible for sending delayed messages
   * CHANGED: Injecting `io` and `pubClient` to support scalable architecture
   */
  startMessageScheduler(io, pubClient);

})
.catch((err) => {
  logger.error(`Redis Connection Error: ${err.message}`);
});


/* =========================================================
   SERVER START
   ========================================================= */

const PORT = process.env.PORT || 5000;

/**
 * Start HTTP server
 */
server.listen(PORT, () =>
  logger.info(`Server started on Port ${PORT}`)
);


/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

/**
 * Handles application shutdown properly.
 *
 * Ensures:
 * - MongoDB connections close
 * - Redis clients disconnect
 * - Server stops accepting new requests
 */
process.on('SIGINT', async () => {

  logger.info("SIGINT signal received: Closing server & cleaning up resources...");

  server.close(async () => {

    try {

      const mongoose = require("mongoose");

      // Close MongoDB connection
      await mongoose.connection.close();

      // Close Redis connections
      await pubClient.quit();
      await subClient.quit();

      logger.info("MongoDB and Redis connections closed cleanly. Exiting.");

      process.exit(0);

    } catch (err) {

      logger.error(`Error during shutdown: ${err.message}`);

      process.exit(1);

    }

  });

});