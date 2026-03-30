/**
 * Main Application Entry Point
 * ----------------------------------------
 * This file initializes and configures the backend server.
 */

require("dotenv").config({ path: require('path').resolve(__dirname, '.env') });

// --- STRICT ENVIRONMENT VALIDATION ---
const requiredEnv = ["MONGO_URI", "REDIS_URI", "JWT_SECRET", "CLIENT_URL"];
const missingEnv = requiredEnv.filter(envVar => !process.env[envVar]);

if (missingEnv.length > 0) {
  console.error(`❌ FATAL ERROR: Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

console.log("✅ All required environment variables are set.");

// --- CORE FRAMEWORK IMPORTS ---
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const socket = require("socket.io");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const mongoSanitize = require("express-mongo-sanitize"); // <-- Added for NoSQL injection protection

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
console.log("📦 Loading routes...");
const aiRoutes = require("./routes/aiRoutes");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const groupRoutes = require("./routes/groupRoutes");
const storyRoutes = require("./routes/storyRoutes");
const e2eRoutes = require("./routes/e2eRoutes");

// --- MIDDLEWARE ---
console.log("📦 Loading middleware...");
const { errorHandler } = require("./middleware/errorMiddleware");
const verifyToken = require("./middleware/authMiddleware");

// --- SOCKET HANDLERS ---
console.log("📦 Loading socket handlers...");
const socketHandler = require("./socket/socketHandler");
const changeStreams = require("./socket/changeStreams");

// --- BACKGROUND WORKERS ---
console.log("📦 Loading workers...");
const { startMessageScheduler } = require("./workers/messageScheduler");
require("./workers/mediaWorker");

// --- EXPRESS APPLICATION INITIALIZATION ---
const app = express();
const server = http.createServer(app);

/* =========================================================
   CENTRALIZED CORS CONFIGURATION
   ========================================================= */
const corsOptions = {
  origin: [
    process.env.CLIENT_URL, 
    "https://best-chat-app-frontend.onrender.com", 
    "http://localhost:3000"
  ].filter(Boolean),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true, // Kept for legacy compatibility, though cookies are disabled
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization", "x-auth-token"]
};

/* =========================================================
   MIDDLEWARE & SECURITY CONFIGURATION
   ========================================================= */

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(metricsMiddleware);

// SECURITY FIX: /metrics was publicly accessible, leaking internal server telemetry
// (request counts, latency histograms, hostnames) to anyone who could reach the port.
// Now requires a shared secret header so only internal scrapers (e.g. Prometheus) can read it.
app.get('/metrics', async (req, res) => {
  const secret = process.env.METRICS_SECRET;
  if (secret && req.headers['x-metrics-secret'] !== secret) {
    return res.status(403).json({ msg: "Forbidden" });
  }
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// PERF/SECURITY FIX: 50 MB JSON limit allowed a single request to exhaust server memory.
// API bodies never need to be this large — media goes directly to Cloudinary from the client.
// Reduced to 1 MB for API safety. File uploads use multipart, not JSON.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// Prevent NoSQL Injection attacks
app.use(mongoSanitize()); // <-- Added here

/* =========================================================
   RATE LIMITING
   ========================================================= */
const authLimiter = rateLimit({
  // BUGFIX: process.env values are always strings. Passing "100" (string) to rateLimit()
  // could silently disable the limit depending on the library version. Always parseInt.
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 10,
  message: "Too many requests, please try again later."
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
// NOTE: storyRoutes and aiRoutes apply verifyToken on every handler inside their own
// route files, so no top-level middleware is needed here. If you add new routes to
// those files, always include verifyToken — do NOT rely on the mount point alone.
app.use("/api/stories", storyRoutes);
app.use("/health", require("./routes/healthRoute"));
app.use("/api/ai", aiRoutes);
app.use("/api/e2e", verifyToken, e2eRoutes);

app.use(errorHandler);

/* =========================================================
   SOCKET.IO INITIALIZATION
   ========================================================= */
const io = socket(server, {
  cors: corsOptions, // Reusing the centralized CORS config
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
const isTLS = redisUrl.startsWith("rediss://");

const pubClient = createClient({
  url: redisUrl,
  socket: {
    family: 4,
    tls: isTLS,
    reconnectStrategy: (retries) => Math.min(retries * 50, 3000)
  }
});

pubClient.on("error", (err) => {
  console.error(`❌ Redis pubClient Error: ${err.message}`);
  logger.error(`Redis pubClient Background Error: ${err.message}`);
});

const subClient = pubClient.duplicate();

subClient.on("error", (err) => {
  console.error(`❌ Redis subClient Error: ${err.message}`);
  logger.error(`Redis subClient Background Error: ${err.message}`);
});

/* =========================================================
   SYNCHRONIZED STARTUP
   ========================================================= */
const PORT = process.env.PORT || 5000;

const startupTimeout = setTimeout(() => {
  console.error("❌ TIMEOUT: Startup took too long — MongoDB or Redis is hanging.");
  process.exit(1);
}, 20000);

console.log("🚀 Starting MongoDB and Redis connections...");

Promise.all([
  connectDB(),
  pubClient.connect(),
  subClient.connect()
])
.then(() => {
  clearTimeout(startupTimeout);

  console.log("✅ MongoDB and Redis connected successfully.");
  logger.info("MongoDB and Redis connected successfully. Initializing services...");

  setupMeilisearch();

  io.adapter(createAdapter(pubClient, subClient));
  console.log("✅ Redis Adapter connected to Socket.io.");

  /* =========================================================
     STRICT SOCKET AUTHENTICATION
     ========================================================= */
  io.use((socket, next) => {
    // We use 'let' so we can modify the token if it has the Bearer prefix
    let token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    // CRITICAL FIX: Strip the "Bearer " prefix if it was included in the auth payload
    if (token.startsWith("Bearer ")) {
      token = token.replace("Bearer ", "").trim();
    }

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