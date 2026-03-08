require("dotenv").config(); // This must be at the very top!

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const socket = require("socket.io");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser"); 

// --- MERGE UPDATE: Security Imports ---
const jwt = require("jsonwebtoken"); // Needed for Socket.io authentication
const verifyToken = require("./middleware/authMiddleware"); // Needed for API route protection

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

// --- PHASE 2 IMPORT: For Scheduled Messages ---
const Message = require("./models/Message"); 

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

// --- MERGE UPDATE: PRODUCTION CORS FIX ---
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
})); 

app.use(cookieParser()); 
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- ROUTES ---
app.use("/api/auth", authRoutes); // Auth routes remain public
app.use("/api/messages", verifyToken, messageRoutes); 
app.use("/api/groups", verifyToken, groupRoutes);

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
// --- MERGE UPDATE: PRODUCTION SOCKET CORS FIX ---
const io = socket(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Expose Socket globally so controllers and background workers can use it to emit events
global.chatSocket = io; 

// Setup Redis Clients for Socket.io scaling
const pubClient = createClient({ url: process.env.REDIS_URI || "redis://localhost:6379" });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Redis Adapter connected to Socket.io");
  
  // --- MERGE UPDATE: Socket.io JWT Authentication Middleware ---
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error("Authentication error: Invalid token"));
      
      // Attach userId to the socket object so it's reliably available on disconnect/events
      socket.userId = decoded.id; 
      next();
    });
  });

  // Delegate real-time logic to the dedicated handler only AFTER Redis is ready
  socketHandler(io);
}).catch((err) => {
  logger.error(`Redis Connection Error: ${err.message}`);
});


// ==========================================
// PHASE 2: SCHEDULED MESSAGE WORKER
// ==========================================
// Runs every 30 seconds to check for messages that need to be delivered
setInterval(async () => {
  try {
      const now = new Date();
      
      // Find messages scheduled for the past/present that haven't been sent yet
      const pendingMessages = await Message.find({
          isSent: false,
          scheduledAt: { $lte: now }
      });

      if (pendingMessages.length > 0) {
          for (let msg of pendingMessages) {
              // Mark the message as officially sent
              msg.isSent = true;
              msg.status = "sent";
              await msg.save();

              // Send the message via WebSockets if the server is ready
              if (global.chatSocket && global.onlineUsers) {
                  // --- MERGE UPDATE (Step 8): Fix Scheduled Messages for Groups & correct Socket Routing ---
                  // Grab ALL recipients of this message (excluding the sender) using .filter()
                  const targetUsers = msg.users.filter(id => id.toString() !== msg.sender.toString());
                  
                  // Iterate through every recipient and send it to their specific active Socket ID
                  targetUsers.forEach(targetId => {
                      const receiverSocket = global.onlineUsers.get(targetId.toString());
                      
                      if (receiverSocket) {
                          global.chatSocket.to(receiverSocket).emit("msg-recieve", {
                              id: msg._id.toString(),
                              from: msg.sender.toString(),
                              to: targetId.toString(),
                              msg: msg.message?.text || msg.message.text, 
                              type: msg.type,
                              createdAt: msg.createdAt,
                              timer: msg.timer,
                              isViewOnce: msg.isViewOnce,
                              isForwarded: msg.isForwarded,
                              pollData: msg.pollData,
                              linkMetadata: msg.linkMetadata,
                              isGroup: msg.users.length > 2 // Inference flag for the frontend UI
                          });
                      }
                  });
              }
          }
          logger.info(`[Scheduler] Processed and sent ${pendingMessages.length} scheduled message(s).`);
      }
  } catch (err) {
      logger.error(`[Scheduler Error]: ${err.message}`);
  }
}, 30000); // 30000 ms = 30 seconds