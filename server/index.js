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

require("dotenv").config({ path: require('path').resolve(__dirname, '.env') });

// --- DEBUG: Print env var presence immediately on startup ---
console.log("🔍 ENV CHECK:", {
  MONGO_URI: process.env.MONGO_URI ? "✅ set" : "❌ MISSING",
  REDIS_URI: process.env.REDIS_URI ? "✅ set" : "❌ MISSING",
  JWT_SECRET: process.env.JWT_SECRET ? "✅ set" : "❌ MISSING",
  PORT: process.env.PORT || "(not set, will use 5000)"
});

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

// --- SCALABILITY, PERFORMANCE, & METRICS IMPORTS ---
const { createClient } = require("redis"); // Redis client
const { createAdapter } = require("@socket.io/redis-adapter"); // Allows Socket.io to scale across multiple servers
const { metricsMiddleware, register } = require("./utils/metrics"); // STEP 1: Metrics
const customParser = require("socket.io-msgpack-parser"); // STEP 3: Binary Serialization

// STEP 5: Import Meilisearch setup
const { setupMeilisearch } = require("./utils/meilisearch");

// --- API ROUTES ---
console.log("📦 Loading routes...");
const aiRoutes = require("./routes/aiRoutes");
console.log("✅ aiRoutes loaded");
const authRoutes = require("./routes/authRoutes");
console.log("✅ authRoutes loaded");
const messageRoutes = require("./routes/messagesRoute");
console.log("✅ messageRoutes loaded");
const groupRoutes = require("./routes/groupRoutes");
console.log("✅ groupRoutes loaded");
const storyRoutes = require("./routes/storyRoutes");
console.log("✅ storyRoutes loaded");
const e2eRoutes = require("./routes/e2eRoutes");
console.log("✅ e2eRoutes loaded");

// --- MIDDLEWARE ---
console.log("📦 Loading middleware...");
const { errorHandler } = require("./middleware/errorMiddleware");
console.log("✅ errorMiddleware loaded");
const verifyToken = require("./middleware/authMiddleware");
console.log("✅ authMiddleware loaded");

// --- SOCKET HANDLERS ---
console.log("📦 Loading socket handlers...");
const socketHandler = require("./socket/socketHandler");
console.log("✅ socketHandler loaded");
const changeStreams = require("./socket/changeStreams");
console.log("✅ changeStreams loaded");

// --- BACKGROUND WORKERS ---
console.log("📦 Loading workers...");
const { startMessageScheduler } = require("./workers/messageScheduler");
console.log("✅ messageScheduler loaded");
require("./workers/mediaWorker");
console.log("✅ mediaWorker loaded");

// --- EXPRESS APPLICATION INITIALIZATION ---
const app = express();

// Create HTTP server explicitly to attach Socket.io
const server = http.createServer(app);


/* =========================================================
   MIDDLEWARE & SECURITY CONFIGURATION
   ========================================================= */

// PRODUCTION FIX: Trust reverse proxy (e.g., Heroku, Render, Nginx) 
// so express-rate-limit tracks correct client IP addresses.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// STEP 1: Apply metrics middleware FIRST to track all requests accurately
app.use(metricsMiddleware);

// Expose /metrics endpoint for Prometheus/Grafana to scrape
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

/**
 * Helmet helps secure Express apps by setting various HTTP headers.
 */
app.use(helmet());

/**
 * CORS configuration - BULLETPROOF FIX
 */
app.use(cors({
  origin: [
    process.env.CLIENT_URL, 
    "https://best-chat-app-frontend.onrender.com", 
    "http://localhost:3000"
  ].filter(Boolean), // Safely removes undefined values if env var is missing
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

// Explicitly handle pre-flight OPTIONS requests for all routes
app.options('*', cors());

/**
 * Cookie parser middleware
 */
app.use(cookieParser());

/**
 * JSON body parser
 */
app.use(express.json({ limit: "50mb" }));

/**
 * URL encoded body parser
 */
app.use(express.urlencoded({ limit: "50mb", extended: true }));


/* =========================================================
   RATE LIMITING
   ========================================================= */

const authLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 10,
  message: "Too many requests, please try again later."
});


/* =========================================================
   SWAGGER DOCUMENTATION
   ========================================================= */

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


/* =========================================================
   API ROUTES
   ========================================================= */

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/messages", verifyToken, messageRoutes);
app.use("/api/groups", verifyToken, groupRoutes);
app.use("/api/stories", storyRoutes);
app.use("/health", require("./routes/healthRoute"));
app.use("/api/ai", aiRoutes);

// STEP 7: Expose the secure E2EE routes
app.use("/api/e2e", verifyToken, e2eRoutes);


/* =========================================================
   GLOBAL ERROR HANDLER
   ========================================================= */

app.use(errorHandler);


/* =========================================================
   SOCKET.IO INITIALIZATION
   ========================================================= */

const io = socket(server, {
  cors: {
    // FIX: Match the robust Express CORS settings for websockets
    origin: [
      process.env.CLIENT_URL, 
      "https://best-chat-app-frontend.onrender.com", 
      "http://localhost:3000"
    ].filter(Boolean),
    credentials: true,
    methods: ["GET", "POST"]
  },
  parser: customParser, // STEP 3: MessagePack binary serialization for smaller payloads
  // PRODUCTION FIX: Mobile connection resilience
  pingTimeout: 60000,  
  pingInterval: 25000, 
});

app.set("io", io);
global.chatSocket = io;


/* =========================================================
   REDIS ADAPTER (SCALABILITY)
   ========================================================= */

const redisUrl = process.env.REDIS_URI || "redis://localhost:6379";
const isTLS = redisUrl.startsWith("rediss://");

const pubClient = createClient({
  url: redisUrl,
  socket: {
    family: 4, // <--- CRITICAL FIX: Strict IPv4 to prevent Render/Upstash timeouts
    tls: isTLS,
    // PRODUCTION FIX: Reconnect strategy for Redis outages
    reconnectStrategy: (retries) => {
      return Math.min(retries * 50, 3000); 
    }
  }
});

// CRITICAL FIX: Catch background errors so they don't crash Node.js
pubClient.on("error", (err) => {
  console.error(`❌ Redis pubClient Error: ${err.message}`);
  logger.error(`Redis pubClient Background Error: ${err.message}`);
});

const subClient = pubClient.duplicate();

// CRITICAL FIX: Catch background errors so they don't crash Node.js
subClient.on("error", (err) => {
  console.error(`❌ Redis subClient Error: ${err.message}`);
  logger.error(`Redis subClient Background Error: ${err.message}`);
});

/**
 * Helper to extract HttpOnly accessToken from socket cookies
 */
function getCookieToken(cookieString) {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp('(^| )accessToken=([^;]+)'));
  return match ? match[2] : null;
}


/* =========================================================
   CRITICAL FIX: SYNCHRONIZED STARTUP
   Wait for DB and Redis to connect before starting streams!
   ========================================================= */

const PORT = process.env.PORT || 5000;

// DIAGNOSTIC: If startup hangs for 20s, print what's stuck and exit
const startupTimeout = setTimeout(() => {
  console.error("❌ TIMEOUT: Startup took too long — MongoDB or Redis is hanging.");
  console.error("🔍 Check MONGO_URI and REDIS_URI environment variables in Render.");
  process.exit(1);
}, 20000);

console.log("🚀 Starting MongoDB and Redis connections...");

Promise.all([
  connectDB(),
  pubClient.connect(),
  subClient.connect()
])
.then(() => {

  clearTimeout(startupTimeout); // ✅ Cancel the timeout — startup succeeded

  console.log("✅ MongoDB and Redis connected successfully.");
  logger.info("MongoDB and Redis connected successfully. Initializing services...");

  setupMeilisearch(); // STEP 5: Initialize the search indexes once DB connects

  io.adapter(createAdapter(pubClient, subClient));

  console.log("✅ Redis Adapter connected to Socket.io.");
  logger.info("Redis Adapter connected to Socket.io");

  /* =========================================================
     SOCKET AUTHENTICATION
     ========================================================= */

  io.use((socket, next) => {
    // STEP 4: Check both handshake auth and secure HttpOnly cookies for JWT validation
    const token = socket.handshake.auth.token || getCookieToken(socket.handshake.headers.cookie);

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
     SOCKET EVENT HANDLERS & STREAMS
     ========================================================= */

  socketHandler(io, pubClient);
  
  // STEP 8 FIX: Safe to initialize MongoDB Change Streams now because the DB is connected
  changeStreams(io, pubClient);

  /* =========================================================
     BACKGROUND WORKERS
     ========================================================= */

  startMessageScheduler(io, pubClient);

  /* =========================================================
     SERVER START
     ========================================================= */

  server.listen(PORT, () => {
    console.log(`✅ Server started on Port ${PORT}`);
    logger.info(`Server started on Port ${PORT}`);
  });

})
.catch((err) => {
  clearTimeout(startupTimeout);
  console.error(`❌ Startup Connection Error: ${err.message}`);
  logger.error(`Startup Connection Error: ${err.message}`);
  process.exit(1);
});


/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

process.on('SIGINT', async () => {

  console.log("⚠️ SIGINT received: Shutting down gracefully...");
  logger.info("SIGINT signal received: Closing server & cleaning up resources...");

  server.close(async () => {
    try {
      const mongoose = require("mongoose");
      // Close MongoDB connection
      await mongoose.connection.close();
      // Close Redis connections
      await pubClient.quit();
      await subClient.quit();

      console.log("✅ MongoDB and Redis connections closed cleanly.");
      logger.info("MongoDB and Redis connections closed cleanly. Exiting.");
      process.exit(0);

    } catch (err) {
      console.error(`❌ Error during shutdown: ${err.message}`);
      logger.error(`Error during shutdown: ${err.message}`);
      process.exit(1);
    }
  });

});