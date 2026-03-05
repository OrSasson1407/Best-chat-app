require("dotenv").config(); // This must be at the very top!

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const socket = require("socket.io");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser"); // NEW: Required for Refresh Token Pattern

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const groupRoutes = require("./routes/groupRoutes");
const { errorHandler } = require("./middleware/errorMiddleware");
const socketHandler = require("./socket/socketHandler");

const app = express();

// Security: Rate Limiting to prevent brute-force attacks on login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: "Too many requests, please try again later."
});

// Apply rate limiting to auth routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use(cors());
app.use(cookieParser()); // NEW: Enables server to read httpOnly cookies for Refresh Tokens
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// Global Error Handler Middleware
app.use(errorHandler);

// DB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log(err.message));

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () =>
  console.log(`Server started on Port ${PORT}`)
);

// --- SOCKET.IO INITIALIZATION ---
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// Delegate real-time logic to the dedicated handler
socketHandler(io);