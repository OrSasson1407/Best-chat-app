const User = require("../../models/User");
const { activeSocketsGauge } = require("../../utils/metrics");

module.exports = (io, socket, redisClient, heartbeatThrottles) => {

  /* =====================================================
     1. USER ONLINE STATUS
     ===================================================== */
  socket.on("add-user", async (_userId) => { // ✅ FIX: renamed param
    // FIX Bug C2: Ignore the client-supplied userId entirely.
    // Trust ONLY the JWT verified user from middleware
    const userId = socket.userId;

    try {
      // Multi-device support
      await redisClient.sAdd(`user_sockets:${userId}`, socket.id);
      await redisClient.expire(`user_sockets:${userId}`, 120); 
      
      // Reverse lookup
      await redisClient.set(`socket_user:${socket.id}`, userId);
      await redisClient.expire(`socket_user:${socket.id}`, 120);

      // Fetch user first so we can read their e2eKeys before updating
      const user = await User.findById(userId).select("e2eKeys e2eStatus privacySettings");

      // Determine real key status from actual stored data
      const hasValidKeys = !!(user?.e2eKeys?.identityKey);

      // Single DB write: mark online + sync e2eStatus in one round-trip
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        "e2eStatus.hasKeys": hasValidKeys,
        "e2eStatus.enabled": hasValidKeys,
      });

      heartbeatThrottles.set(userId, Date.now());

      // Respect privacy
      if (user && user.privacySettings?.lastSeen !== "nobody") {
        socket.broadcast.emit("user-status-change", {
          userId,
          isOnline: true
        });
      }

      // Send online users
      const activeKeys = await redisClient.keys('user_sockets:*');
      const onlineUserIds = activeKeys.map(key =>
        key.replace('user_sockets:', '')
      );

      socket.emit("get-online-users", onlineUserIds);

    } catch (err) {
      console.error("Failed to process add-user:", err.message);
    }
  });

  /* =====================================================
     2. PRESENCE CHECK
     ===================================================== */
  socket.on("check-presence", async (targetUserId) => {
    try {
      const user = await User.findById(targetUserId)
        .select("lastSeen privacySettings");

      if (user?.privacySettings?.lastSeen === "nobody") {
        socket.emit("presence-response", {
          userId: targetUserId,
          isOnline: false,
          lastSeen: null
        });
        return;
      }

      const socketCount = await redisClient.sCard(
        `user_sockets:${targetUserId}`
      );

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
  socket.on("heartbeat", async (_userId) => { // ✅ FIX: do not trust client
    const userId = socket.userId;

    try {
      // Refresh TTL for this device
      await redisClient.sAdd(`user_sockets:${userId}`, socket.id);
      await redisClient.expire(`user_sockets:${userId}`, 120);
      await redisClient.expire(`socket_user:${socket.id}`, 120);

      const now = Date.now();
      const lastDbUpdate = heartbeatThrottles.get(userId) || 0;

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
      const disconnectedUser =
        socket.userId ||
        await redisClient.get(`socket_user:${socket.id}`).catch(() => null);

      if (disconnectedUser) {
        await redisClient.sRem(
          `user_sockets:${disconnectedUser}`,
          socket.id
        );

        await redisClient.del(`socket_user:${socket.id}`);

        await redisClient.hDel("active_calls", disconnectedUser);

        const remainingSockets = await redisClient.sCard(
          `user_sockets:${disconnectedUser}`
        );

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
      console.error("Failed to process disconnect cleanupp:", err.message);
    }
  });
};