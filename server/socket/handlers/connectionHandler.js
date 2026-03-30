const User = require("../../models/User");
const { activeSocketsGauge } = require("../../utils/metrics");

module.exports = (io, socket, redisClient, heartbeatThrottles) => {

  /* =====================================================
     1. USER ONLINE STATUS
     ===================================================== */
  socket.on("add-user", async (userId) => {
    socket.userId = userId;

    try {
      // FIX: Wrapped in try/catch to prevent crash if Redis times out
      // Multi-device support. Add this socket ID to the user's Set
      await redisClient.sAdd(`user_sockets:${userId}`, socket.id);
      // Keep a reverse lookup to find the user ID quickly when the socket disconnects
      await redisClient.set(`socket_user:${socket.id}`, userId);

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
      console.error("Failed to process add-user (Redis or DB error):", err.message);
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

      // FIX: Check if the user has ANY active sockets across all their devices
      const socketCount = await redisClient.sCard(`user_sockets:${targetUserId}`);
      const isOnline = socketCount > 0;

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
      console.error("Failed to fetch presence:", err.message);
    }
  });

  /* =====================================================
     3. HEARTBEAT SYSTEM
     ===================================================== */
  socket.on("heartbeat", async (userId) => {
    try {
      // FIX: Ensure this specific device's socket stays in Redis safely
      await redisClient.sAdd(`user_sockets:${userId}`, socket.id);

      const now = Date.now();
      const lastDbUpdate = heartbeatThrottles.get(userId) || 0;

      // Only update DB every 60 seconds
      if (now - lastDbUpdate > 60000) {
        heartbeatThrottles.set(userId, now);
        await User.findByIdAndUpdate(userId, {
          lastSeen: new Date(now),
          isOnline: true
        });
      }
    } catch (err) {
      console.error("Heartbeat update failed:", err.message);
    }
  });

  /* =====================================================
     4. DISCONNECT HANDLING
     ===================================================== */
  socket.on("disconnect", async () => {
    activeSocketsGauge.dec();
    
    try {
      // FIX: Safe Redis fetches, catching potential timeout rejections
      const disconnectedUser = socket.userId || await redisClient.get(`socket_user:${socket.id}`).catch(() => null);

      if (disconnectedUser) {
        // FIX: Remove ONLY this specific device's socket from the user's Set
        await redisClient.sRem(`user_sockets:${disconnectedUser}`, socket.id);
        
        // Clean up the reverse lookup
        await redisClient.del(`socket_user:${socket.id}`);
        
        // If you are still using Hashes for active calls, handle it here
        await redisClient.hDel("active_calls", disconnectedUser); 
        
        // FIX: Check if the user has any OTHER devices still connected
        const remainingSockets = await redisClient.sCard(`user_sockets:${disconnectedUser}`);

        // If 0, the user has completely closed all apps/tabs on all devices
        if (remainingSockets === 0) {
          heartbeatThrottles.delete(disconnectedUser);
          const offlineTime = new Date();

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
        }
      }
    } catch (err) {
      console.error("Failed to process disconnect cleanup:", err.message);
    }
  });
};