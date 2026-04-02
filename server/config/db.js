const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  // CRITICAL FIX: Removed try/catch + process.exit so errors propagate up to index.js
  // This allows the startup Promise.all to catch and log the real error message.
  const mongoURI = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/chat-app";
  console.log("🔍 Connecting to MongoDB:", mongoURI.substring(0, 40) + "...");

  await mongoose.connect(mongoURI, {
    maxPoolSize: 100,          // Maintain up to 100 socket connections for high traffic
    serverSelectionTimeoutMS: 30000, // ⬆️ FIX: Increased to 30 seconds for Render cold starts
    socketTimeoutMS: 45000,    // Close sockets after 45 seconds of inactivity
    wtimeoutMS: 2500,          // PRODUCTION FIX: Ensure write operations timeout after 2.5s
  });

  logger.info("DB Connection Successful");
};

// =========================================================
// IMPROVEMENT: Connection Event Listeners
// These continuously monitor the connection health after startup.
// =========================================================

mongoose.connection.on("connected", () => {
  logger.info("Mongoose successfully connected to the database.");
});

mongoose.connection.on("error", (err) => {
  logger.error(`Mongoose runtime connection error: ${err.message}`);
});

mongoose.connection.on("disconnected", () => {
  logger.warn("Mongoose disconnected from the database.");
});

// =========================================================
// IMPROVEMENT: Graceful Shutdown
// Ensures database connections are cleanly closed when the server stops,
// preventing data corruption or locked resources.
// =========================================================

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Closing MongoDB connection...`);
  try {
    await mongoose.connection.close(false);
    logger.info("MongoDB connection closed through app termination.");
    process.exit(0);
  } catch (err) {
    logger.error(`Error during graceful shutdown: ${err.message}`);
    process.exit(1);
  }
};

// Listen for Node.js process termination signals
// NOTE: SIGINT is also handled in index.js for full graceful shutdown.
// The handler here acts as a safety net.
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

module.exports = connectDB;