/**
 * Centralized Redis Configuration
 * ----------------------------------------
 * Supports both:
 * - Local Docker Redis (redis://localhost:6379)
 * - Upstash TLS Redis (rediss://...upstash.io:6379)
 */

const redisUrl = process.env.REDIS_URI || "redis://localhost:6379";
const isTLS = redisUrl.startsWith("rediss://");

// Parse host and port from the URL for BullMQ workers
const url = new URL(redisUrl);

/**
 * For BullMQ workers that use { host, port } format
 */
const bullMQConnection = {
  host: url.hostname,
  port: parseInt(url.port) || 6379,
  username: url.username || "default",
  password: url.password || undefined,
  tls: isTLS ? {} : undefined,
};

/**
 * For redis createClient() that uses { url } format
 */
const createRedisClient = () => {
  const { createClient } = require("redis");
  return createClient({
    url: redisUrl,
    socket: {
      tls: isTLS,
    },
  });
};

module.exports = { bullMQConnection, createRedisClient, redisUrl, isTLS };