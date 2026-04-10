/**
 * Main Application Entry Point
 * ----------------------------------------
 * This file initializes and configures the backend server.
 */

require("dotenv").config({ path: require('path').resolve(__dirname, '.env') });

// --- ENVIRONMENT VALIDATION (TEST SAFE) ---
if (process.env.NODE_ENV === 'test') {
  // Inject mock variables safely so Jest tests don't crash
  process.env.MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/chat_test_db";
  process.env.REDIS_URI = process.env.REDIS_URI || "redis://127.0.0.1:6379";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
  process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || "test_refresh_secret";
  process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
  
  // FIX: Provide a dummy key so the OpenAI SDK doesn't crash on instantiation
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-dummy-key-for-jest-tests";
} else {
  // Relaxed validation for standard Dev/Prod
  const requiredEnv = ["JWT_SECRET"];
  
  const missingEnv = requiredEnv.filter(envVar => !process.env[envVar]);
  
  if (missingEnv.length > 0) {
    console.error(`FATAL: Missing env vars: ${missingEnv.join(', ')}`);
    process.exit(1);
  }
}

// --- CORE FRAMEWORK IMPORTS ---
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const socket = require("socket.io");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const mongoSanitize = require("express-mongo-sanitize"); 

// --- OBSERVABILITY & CONFIGURATION ---
const logger = require("./utils/logger");
const swaggerUi = require("swagger-ui-express");
const swaggerDocs = require("./config/swagger");
const connectDB = require("./config/db");

// --- SCALABILITY, PERFORMANCE, & METRICS IMPORTS ---
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const { metricsMiddleware, register } = require("./utils/metrics");
const customParser = require("socket.io-msgpack-parser");
const { setupMeilisearch } = require("./utils/meilisearch");

// --- API ROUTES ---
const aiRoutes = require("./routes/aiRoutes");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const groupRoutes = require("./routes/groupRoutes");
const storyRoutes = require("./routes/storyRoutes");
const e2eRoutes = require("./routes/e2eRoutes");

// --- MIDDLEWARE ---
const { errorHandler } = require("./middleware/errorMiddleware");
const verifyToken = require("./middleware/authMiddleware");

// --- SOCKET HANDLERS ---
const socketHandler = require("./socket/socketHandler");
const changeStreams = require("./socket/changeStreams");

// --- BACKGROUND WORKERS ---
const { startMessageScheduler } = require("./workers/messageScheduler");
require("./workers/mediaWorker");

// --- EXPRESS APPLICATION INITIALIZATION ---
const app = express();
const server = http.createServer(app);

/* =========================================================
   CENTRALIZED CORS CONFIGURATION
   ========================================================= */

// Normalize a URL: trim whitespace and strip trailing slash for reliable comparison.
const normalizeOrigin = (url) => (url || "").trim().replace(/\/+$/, "");

// Build the allowlist from env. CLIENT_URL is set in Render's environment variables.
// Multiple origins can be comma-separated: CLIENT_URL=https://a.onrender.com,https://b.com
const RAW_CLIENT_URLS = (process.env.CLIENT_URL || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const ALLOWED_ORIGINS = [
  ...RAW_CLIENT_URLS,
  "http://localhost:3000",
  "http://localhost:5173",
];

// Log at startup so you can confirm what's in the allowlist from Render logs.
console.log("✅ CORS allowed origins:", ALLOWED_ORIGINS);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    const normalizedRequestOrigin = normalizeOrigin(origin);
    if (ALLOWED_ORIGINS.includes(normalizedRequestOrigin)) return callback(null, true);
    // In non-production, allow any localhost port
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    console.warn(`⚠️  CORS blocked origin: '${origin}'. Allowed: ${ALLOWED_ORIGINS.join(", ")}`);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "x-auth-token",
  ],
  exposedHeaders: ["set-cookie"],
  optionsSuccessStatus: 200,
};

/* =========================================================
   MIDDLEWARE & SECURITY CONFIGURATION
   =========================================================
   ✅ CRITICAL FIX: CORS MUST BE FIRST — before helmet and everything else!
   ========================================================= */
app.options('*', cors(corsOptions));   // Handle ALL preflight OPTIONS requests
app.use(cors(corsOptions));            // Attach CORS headers to every response

// Helmet runs AFTER cors so it cannot strip our Access-Control-* headers.
// crossOriginEmbedderPolicy is disabled because it blocks cross-origin fetches
// when credentials are involved (it would fight our CORS setup).
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,   // ← must be false; true blocks credentialed cross-origin XHR
}));

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Now it's safe to run metrics because CORS is already handled
app.use(metricsMiddleware);

app.get('/metrics', async (req, res) => {
  const secret = process.env.METRICS_SECRET;
  if (secret && req.headers['x-metrics-secret'] !== secret) {
    return res.status(403).json({ msg: "Forbidden" });
  }
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(mongoSanitize());

/* =========================================================
   RATE LIMITING
   ========================================================= */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 10,
  message: "Too many requests, please try again later.",
});

/* =========================================================
   API ROUTES
   ========================================================= */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/messages", verifyToken, messageRoutes);
app.use("/api/groups", verifyToken, groupRoutes);
app.use("/api/stories", storyRoutes);
app.use("/health", require("./routes/healthRoute"));
app.use("/api/ai", aiRoutes);
app.use("/api/e2e", verifyToken, e2eRoutes);

app.use(errorHandler);

/* =========================================================
   SOCKET.IO INITIALIZATION
   ========================================================= */
const io = socket(server, {
  cors: corsOptions,
  parser: customParser,
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set("io", io);
global.chatSocket = io;

/* =========================================================
   REDIS ADAPTER (SCALABILITY)
   ========================================================= */
const redisUrl = process.env.REDIS_URI || "redis://localhost:6379";

const pubClient = createClient({
  url: redisUrl,
  socket: {
    family: 4, // Forces IPv4 to prevent Render/Upstash timeouts
    reconnectStrategy: (retries) => Math.min(retries * 50, 3000),
  },
});

pubClient.on("error", (err) => {
  if (process.env.NODE_ENV !== 'test') console.error(`❌ Redis pubClient Error: ${err.message}`);
});

const subClient = pubClient.duplicate();

subClient.on("error", (err) => {
  if (process.env.NODE_ENV !== 'test') console.error(`❌ Redis subClient Error: ${err.message}`);
});

/* =========================================================
   SYNCHRONIZED STARTUP
   ========================================================= */
const PORT = process.env.NODE_ENV === 'test' ? 0 : (process.env.PORT || 5000);

const startupTimeout = setTimeout(() => {
  console.error("❌ TIMEOUT: Startup took too long — MongoDB or Redis is hanging.");
  process.exit(1);
}, 45000);

if (process.env.NODE_ENV !== 'test') console.log("🚀 Starting MongoDB and Redis connections...");

Promise.all([
  connectDB(),
  pubClient.connect(),
  subClient.connect(),
])
.then(() => {
  clearTimeout(startupTimeout);

  if (process.env.NODE_ENV !== 'test') console.log("✅ MongoDB and Redis connected successfully.");

  setupMeilisearch();

  io.adapter(createAdapter(pubClient, subClient));
  app.set("redisClient", pubClient);

  /* =========================================================
     STRICT SOCKET AUTHENTICATION
     ========================================================= */
  io.use((socket, next) => {
    let token = socket.handshake.auth.token;

    if (!token || token === "null" || token === "undefined") {
      return next(new Error("Authentication error: No token provided"));
    }

    token = token.split(" ").pop().trim();

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error: Invalid token"));
      }
      socket.userId = decoded.id;
      next();
    });
  });

  /* =========================================================
     MOUNT EVENT HANDLERS & BACKGROUND JOBS
     ========================================================= */
  socketHandler(io, pubClient);
  changeStreams(io, pubClient);
  startMessageScheduler(io, pubClient);

  server.listen(PORT, () => {
    const actualPort = server.address().port;
    if (process.env.NODE_ENV !== 'test') console.log(`✅ Server started on Port ${actualPort}`);
  });
})
.catch((err) => {
  clearTimeout(startupTimeout);;
  console.error(`❌ Startup Connection Error: ${err.message}`);
  process.exit(1);
});

/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */
process.on('SIGINT', async () => {
  console.log("⚠️ SIGINT received: Shutting down gracefully...");
  
  server.close(async () => {
    try {
      const mongoose = require("mongoose");
      await mongoose.connection.close();
      await pubClient.quit();
      await subClient.quit();

      console.log("✅ Connections closed cleanly. Exiting.");
      process.exit(0);
    } catch (err) {
      console.error(`❌ Error during shutdown: ${err.message}`);
      process.exit(1);
    }
  });
});

/* =========================================================
   ANTI-CRASH SAFETY NETS
   ========================================================= */
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITICAL: Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 CRITICAL: Unhandled Promise Rejection:', reason);
});

// Export for testingggg
module.exports = { app, server };