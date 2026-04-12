/**
 * Socket Orchestrator
 * ---------------------------------------------------------
 * This module defines all real-time communication logic
 * using Socket.io for the chat backend.
 * * Responsibilities:
 * - Acts as the central hub for socket connections.
 * - Delegates specific events to dedicated handler modules.
 * - Tracks global metrics for the connection lifecycle.
 */

// STEP 1 FIX: Import Prometheus Metrics
const { activeSocketsGauge } = require("../utils/metrics");

// Import our new modular handlers
const registerConnectionHandlers = require("./handlers/connectionHandler");
const registerMessageHandlers = require("./handlers/messageHandler");
const registerCallHandlers = require("./handlers/callHandler");
const registerGroupHandlers = require("./handlers/groupHandler");

/**
 * Initialize Socket Event Handlers
 *
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {RedisClient} redisClient - Connected Redis client for distributed state
 */
module.exports = (io, redisClient) => {

  /**
   * Used to throttle DB updates from heartbeat
   * to avoid excessive writes. Shared across connection events.
   *
   * Key   → userId
   * Value → timestamp of last DB update
   */
  const heartbeatThrottles = new Map();

  /**
   * Triggered whenever a client connects to the socket server
   */
  io.on("connection", (socket) => {

    // ✅ CRITICAL FIX: Graceful fail if metrics module isn't initialized perfectly
    try {
      if (activeSocketsGauge && typeof activeSocketsGauge.inc === "function") {
        activeSocketsGauge.inc();
      }
    } catch (err) {
      console.warn("⚠️ Metric Gauge skipped: ", err.message);
    }

    /* =====================================================
       CRITICAL FIX: Memory Leak Prevention
       ===================================================== */
    socket.on("disconnect", () => {
      // Ensure we remove the user from the heartbeat throttle Map
      // when their socket disconnects to prevent indefinite memory growth.
      if (socket.userId && heartbeatThrottles.has(socket.userId)) {
        heartbeatThrottles.delete(socket.userId);
      }
    });

    /* =====================================================
       REGISTER MODULAR HANDLERS
       ===================================================== */
    
    // 1. Connection & Presence Events (add-user, heartbeat, check-presence, disconnect)
    registerConnectionHandlers(io, socket, redisClient, heartbeatThrottles);

    // 2. Messaging Events (send-msg, receipts, edit, delete, reactions)
    registerMessageHandlers(io, socket, redisClient);

    // 3. WebRTC Calling Events (call-user, answer-call, ice-candidate, end-call)
    registerCallHandlers(io, socket, redisClient);

    // 4. Group & Typing Events (join-group, typing)
    registerGroupHandlers(io, socket, redisClient);

  });

};