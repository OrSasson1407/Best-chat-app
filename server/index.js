require("dotenv").config(); // This must be at the very top!

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const socket = require("socket.io");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser"); 

// --- LEVEL 1 IMPORTS (OBSERVABILITY) ---
const logger = require("./utils/logger");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// --- LEVEL 2 IMPORTS (SCALABILITY) ---
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const groupRoutes = require("./routes/groupRoutes");
const { errorHandler } = require("./middleware/errorMiddleware");
const socketHandler = require("./socket/socketHandler");

const app = express();

// --- SWAGGER CONFIGURATION ---
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Best Chat App API",
      version: "1.0.0",
      description: "API documentation for the real-time chat application",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
      },
    ],
  },
  apis: ["./routes/*.js"], 
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// --- MIDDLEWARE & SECURITY ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: "Too many requests, please try again later."
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
})); 

app.use(cookieParser()); 
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// --- LEVEL 4: ENTERPRISE HEALTH CHECK ---
// Exposes the deep system health route we created for load balancers
app.use("/health", require("./routes/healthRoute")); 

// --- GLOBAL ERROR HANDLER ---
app.use(errorHandler);

// --- DB CONNECTION ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("DB Connection Successful"))
  .catch((err) => logger.error(`DB Connection Error: ${err.message}`));

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () =>
  logger.info(`Server started on Port ${PORT}`)
);

// --- SOCKET.IO INITIALIZATION WITH REDIS ADAPTER ---
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// Setup Redis Clients for Socket.io scaling
const pubClient = createClient({ url: process.env.REDIS_URI || "redis://localhost:6379" });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Redis Adapter connected to Socket.io");
  
  // Delegate real-time logic to the dedicated handler only AFTER Redis is ready
  socketHandler(io);
}).catch((err) => {
  logger.error(`Redis Connection Error: ${err.message}`);
});