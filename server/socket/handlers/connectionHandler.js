const User = require("../../models/User");
const { activeSocketsGauge } = require("../../utils/metrics");

module.exports = (io, socket, redisClient, heartbeatThrottles) => {

  /* =====================================================
     1. USER ONLINE STATUS
     ===================================================== */
  socket.on("add-user", async (userId) => {
    // Save socketId for the user in Redis (syncs across servers)
    await redisClient.hSet("online_users", userId, socket.id);
    socket.userId = userId;

    try {
      // Mark user online in database
      const user = await User.findByIdAndUpdate(
        userId,
        { isOnline: true },
        { new: true }
      );

      heartbeatThrottles.set(userId, Date.now());

      // Respect privacy settings
      if (user && user.privacySettings?.lastSeen !== "nobody") {
        // Broadcast to active peers instead of sending the whole DB to everyone
        socket.broadcast.emit("user-status-change", {
          userId,
          isOnline: true
        });
      }
    } catch (err) {
      console.error("Failed to update online status:", err);
    }
  });

  /* =====================================================
     2. PRESENCE CHECK
     ===================================================== */
  socket.on("check-presence", async (targetUserId) => {
    try {
      const user = await User.findById(targetUserId).select("lastSeen privacySettings");

      // Respect privacy settings
      if (user?.privacySettings?.lastSeen === "nobody") {
        socket.emit("presence-response", {
          userId: targetUserId,
          isOnline: false,
          lastSeen: null
        });
        return;
      }

      // Check Redis
      const isOnline = await redisClient.hExists("online_users", targetUserId);

      if (isOnline) {
        socket.emit("presence-response", {
          userId: targetUserId,
          isOnline: true
        });
      } else {
        socket.emit("presence-response", {
          userId: targetUserId,
          isOnline: false,
          lastSeen: user?.lastSeen || null
        });
      }
    } catch (err) {
      console.error("Failed to fetch presence:", err);
    }
  });

  /* =====================================================
     3. HEARTBEAT SYSTEM
     ===================================================== */
  socket.on("heartbeat", async (userId) => {
    // Ensure they stay in Redis
    await redisClient.hSet("online_users", userId, socket.id);

    const now = Date.now();
    const lastDbUpdate = heartbeatThrottles.get(userId) || 0;

    // Only update DB every 60 seconds
    if (now - lastDbUpdate > 60000) {
      heartbeatThrottles.set(userId, now);
      try {
        await User.findByIdAndUpdate(userId, {
          lastSeen: new Date(now),
          isOnline: true
        });
      } catch (err) {
        console.error("Heartbeat update failed", err);
      }
    }
  });

  /* =====================================================
     4. DISCONNECT HANDLING
     ===================================================== */
  socket.on("disconnect", async () => {
    activeSocketsGauge.dec();
    const disconnectedUser = socket.userId;

    if (disconnectedUser) {
      // Remove from Redis State
      await redisClient.hDel("online_users", disconnectedUser);
      await redisClient.hDel("active_calls", disconnectedUser);
      
      heartbeatThrottles.delete(disconnectedUser);
      const offlineTime = new Date();

      try {
        const user = await User.findByIdAndUpdate(
          disconnectedUser,
          { lastSeen: offlineTime, isOnline: false },
          { new: true }
        );

        if (user && user.privacySettings?.lastSeen !== "nobody") {
          io.emit("user-offline", {
            userId: disconnectedUser,
            lastSeen: offlineTime
          });

          socket.broadcast.emit("user-status-change", {
            userId: disconnectedUser,
            isOnline: false,
            lastSeen: offlineTime.toISOString()
          });
        }
      } catch (err) {
        console.error("Failed to update last seen:", err);
      }
    }
  });
};