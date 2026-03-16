const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    // 1. IMPROVEMENT: Use Environment Variables for the connection string
    // Fallback to the local URI for development if the env variable isn't set.
const mongoURI = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/chat-app";

    // 2. IMPROVEMENT: Configure Connection Pooling Options
    await mongoose.connect(mongoURI, {
      maxPoolSize: 100, // Maintain up to 100 socket connections for high traffic
      serverSelectionTimeoutMS: 5000, // Time out after 5 seconds if DB is unreachable
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      wtimeoutMS: 2500, // PRODUCTION FIX: Ensure write operations timeout after 2.5s instead of hanging
    });

    logger.info("DB Connection Successful");
  } catch (err) {
    logger.error(`DB Initial Connection Error: ${err.message}`);
    process.exit(1); // Exit process with failure if DB fails to connect at startup
  }
};

// =========================================================
// 3. IMPROVEMENT: Connection Event Listeners
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
// 4. IMPROVEMENT: Graceful Shutdown
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

// Listen for Node.js process termination signals (e.g., Ctrl+C, Docker stop, Heroku restart)
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

module.exports = connectDB;