require("dotenv").config(); // This must be at the very top!

const express = require("express");
const http = require("http"); // Explicitly require HTTP
const cors = require("cors");
const helmet = require("helmet"); // --- UPDATE: Added Helmet for Security ---
const socket = require("socket.io");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser"); 
const jwt = require("jsonwebtoken");

// --- LEVEL 1 IMPORTS (OBSERVABILITY & CONFIG) ---
const logger = require("./utils/logger");
const swaggerUi = require("swagger-ui-express");
const swaggerDocs = require("./config/swagger"); // --- UPDATE: Extracted Swagger ---
const connectDB = require("./config/db"); // --- UPDATE: Extracted DB connection ---

// --- LEVEL 2 IMPORTS (SCALABILITY) ---
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const groupRoutes = require("./routes/groupRoutes");
const { errorHandler } = require("./middleware/errorMiddleware");
const verifyToken = require("./middleware/authMiddleware");
const socketHandler = require("./socket/socketHandler");

// --- PHASE 2 IMPORT: Extracted Scheduled Messages Worker ---
const startMessageScheduler = require("./workers/messageScheduler"); 

const app = express();
const server = http.createServer(app);

// --- MIDDLEWARE & SECURITY ---
app.use(helmet()); // Protects against common web vulnerabilities

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
})); 

app.use(cookieParser()); 
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- UPDATE: Configurable Rate Limiter ---
const authLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, 
  max: process.env.RATE_LIMIT_MAX || 100, 
  message: "Too many requests, please try again later."
});

// --- SWAGGER CONFIGURATION ---
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// --- ROUTES ---
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth", authRoutes); 
app.use("/api/messages", verifyToken, messageRoutes); 
app.use("/api/groups", verifyToken, groupRoutes);
app.use("/health", require("./routes/healthRoute")); 

// --- GLOBAL ERROR HANDLER ---
app.use(errorHandler);

// --- DB CONNECTION ---
connectDB();

// --- SOCKET.IO INITIALIZATION WITH REDIS ADAPTER ---
const io = socket(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Best Practice: Attach io to Express so routes can use it via req.app.get('io')
app.set("io", io); 
// Keeping global declaration to support your existing controllers, but migrating away is recommended
global.chatSocket = io; 

// Setup Redis Clients for Socket.io scaling
const pubClient = createClient({ url: process.env.REDIS_URI || "redis://localhost:6379" });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Redis Adapter connected to Socket.io");
  
  // Socket.io JWT Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: No token provided"));

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error("Authentication error: Invalid token"));
      socket.userId = decoded.id; 
      next();
    });
  });

  // Delegate real-time logic
  socketHandler(io);

  // --- UPDATE: Initialize Background Worker after infrastructure is ready ---
  startMessageScheduler();

}).catch((err) => {
  logger.error(`Redis Connection Error: ${err.message}`);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () =>
  logger.info(`Server started on Port ${PORT}`)
);

// --- UPDATE: GRACEFUL SHUTDOWN ---
process.on('SIGINT', async () => {
  logger.info("SIGINT signal received: Closing server & cleaning up resources...");
  
  // Stop accepting new connections
  server.close(async () => {
    try {
      const mongoose = require("mongoose");
      await mongoose.connection.close();
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