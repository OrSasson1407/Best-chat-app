/**
 * Socket Handler
 * ---------------------------------------------------------
 * This module defines all real-time communication logic
 * using Socket.io for the chat backend.
 *
 * Responsibilities:
 * - Track online users via Redis (Scalable)
 * - Handle real-time messaging (direct + group)
 * - Throttled typing indicators (Redis-backed)
 * - Emoji reactions
 * - Message read receipts
 * - Message editing & deletion
 * - Presence system (online / last seen)
 * - Heartbeat system for active sessions
 * - WebRTC signaling with Call State Management
 *
 * This file acts as the **central real-time event hub**
 * of the chat application.
 */

const User = require("../models/User");
const Message = require("../models/Message");
const Group = require("../models/GroupModel"); // Group chat model
const { notificationQueue } = require("../workers/notificationWorker"); // BullMQ Push Notifications

// STEP 1 FIX: Import Prometheus Metrics
const { activeSocketsGauge, messageLatencyHistogram } = require("../utils/metrics");

/**
 * DISTRIBUTED RATE LIMITER (Redis-Backed)
 * Uses Redis SET command with NX (Not eXists) and PX (expiration in ms)
 * to atomically ensure a user cannot spam events across multiple servers.
 */
const isRateLimited = async (redisClient, socketId, action, limitMs) => {
  const key = `rate_limit:${socketId}:${action}`;
  // Returns true if the key was set (meaning they are allowed), null if it already existed (rate limited)
  const allowed = await redisClient.set(key, "1", { NX: true, PX: limitMs });
  return !allowed; 
};

/**
 * STEP 4 FIX: AUTOMATED CONTENT MODERATION
 * Simple automated moderation function to detect malicious links and spam
 */
function detectSpamOrMalicious(text) {
  if (!text) return false;
  // Block common phishing keywords or suspicious patterns
  const forbiddenPatterns = [
    /free.*crypto/i,
    /click.*here.*win/i,
    /http.*(phish|malware)\.com/i
  ];
  return forbiddenPatterns.some(regex => regex.test(text));
}

/**
 * Initialize Socket Event Handlers
 *
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {RedisClient} redisClient - Connected Redis client for distributed state
 */
module.exports = (io, redisClient) => {

  /**
   * Used to throttle DB updates from heartbeat
   * to avoid excessive writes.
   *
   * Key   → userId
   * Value → timestamp of last DB update
   */
  const heartbeatThrottles = new Map();

  /**
   * Triggered whenever a client connects to the socket server
   */
  io.on("connection", (socket) => {

    // STEP 1 FIX: Increment active socket metric
    activeSocketsGauge.inc();

    /* =====================================================
       1. USER ONLINE STATUS
       ===================================================== */

    /**
     * Register user when they connect
     */
    socket.on("add-user", async (userId) => {

      // Save socketId for the user in Redis (syncs across servers)
      await redisClient.hSet("online_users", userId, socket.id);

      socket.userId = userId;

      /**
       * Broadcast list of online users from Redis
       */
      const onlineUsersArray = await redisClient.hKeys("online_users");
      io.emit("get-online-users", onlineUsersArray);

      try {

        /**
         * Mark user online in database
         */
        const user = await User.findByIdAndUpdate(
          userId,
          { isOnline: true },
          { new: true }
        );

        heartbeatThrottles.set(userId, Date.now());

        /**
         * Respect privacy settings
         */
        if (user && user.privacySettings?.lastSeen !== "nobody") {

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

    /**
     * Client requests presence status of another user
     */
    socket.on("check-presence", async (targetUserId) => {

      try {

        const user = await User
          .findById(targetUserId)
          .select("lastSeen privacySettings");

        /**
         * Respect privacy settings
         */
        if (user?.privacySettings?.lastSeen === "nobody") {
          socket.emit("presence-response", {
            userId: targetUserId,
            isOnline: false,
            lastSeen: null
          });
          return;
        }

        // Check Redis instead of local map
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

    /**
     * Heartbeat keeps user session alive
     * and periodically updates lastSeen timestamp.
     */
    socket.on("heartbeat", async (userId) => {

      // Ensure they stay in Redis
      await redisClient.hSet("online_users", userId, socket.id);

      const now = Date.now();
      const lastDbUpdate = heartbeatThrottles.get(userId) || 0;

      /**
       * Only update DB every 60 seconds
       */
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
       4. GROUP ROOM JOIN
       ===================================================== */

    /**
     * Allows user to join group room securely
     */
    socket.on("join-group", async (groupId) => {
      try {
        const group = await Group.findById(groupId).select("users");
        
        // Strict Room Validation: Make sure the user is actually a member of the group
        if (group && group.users.includes(socket.userId)) {
          socket.join(groupId);
        } else {
          socket.emit("error-msg", { message: "You are not authorized to join this group." });
        }
      } catch (err) {
        console.error("Error joining group room:", err);
      }
    });

    /* =====================================================
       5. SEND MESSAGE (DIRECT & GROUP)
       ===================================================== */

    socket.on("send-msg", async (data, callback) => {

      const startTime = Date.now(); // STEP 1 FIX: Track start time for latency metrics

      // Rate limit sending messages to max 5 per second per socket using Redis
      if (await isRateLimited(redisClient, socket.id, "send-msg", 200)) {
        if (callback) callback({ status: "error", msg: "Sending too fast." });
        return;
      }

      // STEP 4 FIX: SPAM / MALICIOUS LINK FILTER
      if (data.type === 'text' && detectSpamOrMalicious(data.msg)) {
        if (callback) callback({ status: "error", msg: "Message blocked by security filter." });
        return; 
      }

      /**
       * GROUP MESSAGE
       */
      if (data.isGroup) {

        try {

          /**
           * Verify channel permissions
           */
          const group = await Group
            .findById(data.to)
            .select("isChannel admins moderators");

          if (group && group.isChannel) {

            const isAllowed =
              group.admins.includes(data.from) ||
              group.moderators.includes(data.from);

            if (!isAllowed) {
              if (callback) {
                callback({
                  status: "error",
                  msg: "Only admins and moderators can post in this channel."
                });
              }
              return;
            }

          }

        } catch (err) {
          console.error("Error verifying channel permissions", err);
        }

        /**
         * Broadcast message to group room
         */
        socket.to(data.to).emit("msg-recieve", {

          id: data.id,
          msg: data.msg,
          from: data.from,
          username: data.username,

          type: data.type,
          createdAt: new Date().toISOString(),

          isGroup: true,

          replyTo: data.replyTo,
          status: "delivered",

          pollData: data.pollData,
          linkMetadata: data.linkMetadata,

          isForwarded: data.isForwarded,
          isViewOnce: data.isViewOnce,

          fileMetadata: data.fileMetadata

        });

        // STEP 1 FIX: Record latency right after emission
        messageLatencyHistogram.observe(Date.now() - startTime);

        if (callback) callback({ status: "sent", id: data.id });

      }

      /**
       * DIRECT MESSAGE
       */
      else {

        // Check Redis for recipient's socket ID
        const receiverSocket = await redisClient.hGet("online_users", data.to);

        if (receiverSocket) {

          socket.to(receiverSocket).emit("msg-recieve", {

            id: data.id,
            msg: data.msg,
            from: data.from,

            type: data.type,
            createdAt: new Date().toISOString(),

            isGroup: false,

            replyTo: data.replyTo,
            status: "delivered",

            pollData: data.pollData,
            linkMetadata: data.linkMetadata,

            isForwarded: data.isForwarded,
            isViewOnce: data.isViewOnce,

            fileMetadata: data.fileMetadata

          });

          // STEP 1 FIX: Record latency right after emission
          messageLatencyHistogram.observe(Date.now() - startTime);

          try {

            await Message.findByIdAndUpdate(
              data.id,
              { status: "delivered" }
            );

          } catch (err) {
            console.error("Error updating delivered status:", err);
          }

          if (callback) callback({ status: "delivered", id: data.id });

        } else {
          
          // RECIPIENT IS OFFLINE: Queue a push notification
          try {
            const offlineUser = await User.findById(data.to).select("fcmToken");
            
            if (offlineUser && offlineUser.fcmToken) {
              const sender = await User.findById(data.from).select("username");
              
              await notificationQueue.add("send_fcm_message", {
                userId: data.to,
                fcmToken: offlineUser.fcmToken,
                title: sender ? sender.username : "New Message",
                body: data.type === 'text' ? data.msg : `Sent a ${data.type}`
              });
            }
          } catch (err) {
             console.error("Failed to queue push notification:", err);
          }

          if (callback) callback({ status: "sent", id: data.id });

        }

      }

    });

    /* =====================================================
       6. TYPING INDICATOR
       ===================================================== */

    socket.on("typing", async (data) => {
      
      // Throttle typing indicators to save bandwidth (max 1 event per 800ms) using Redis
      if (await isRateLimited(redisClient, socket.id, "typing", 800)) return;

      if (data.isGroup) {

        socket.to(data.to).emit("typing-status", {
          from: data.from,
          isTyping: data.isTyping,
          isGroup: true,
          username: data.username
        });

      } else {

        const receiverSocket = await redisClient.hGet("online_users", data.to);

        if (receiverSocket) {
          socket.to(receiverSocket).emit("typing-status", {
            from: data.from,
            isTyping: data.isTyping
          });
        }

      }

    });

    /* =====================================================
       7. EMOJI REACTIONS
       ===================================================== */

    socket.on("send-reaction", async (data) => {

      if (data.isGroup) {
        socket.to(data.to).emit("receive-reaction", data);
      } else {
        const receiverSocket = await redisClient.hGet("online_users", data.to);
        if (receiverSocket) {
          socket.to(receiverSocket).emit("receive-reaction", data);
        }
      }

    });

    /* =====================================================
       8. MESSAGE READ RECEIPTS
       ===================================================== */

    socket.on("mark-as-read", async ({ messageId, from, to, isGroup, username }) => {

      try {

        const readerUser = await User
          .findById(from)
          .select("privacySettings");

        /**
         * Respect read receipt privacy
         */
        if (readerUser && readerUser.privacySettings?.readReceipts === false) {
          return;
        }

        const readData = {
          userId: from,
          username: username || "User",
          readAt: new Date()
        };

        const updateQuery = {
          $push: { readBy: readData }
        };

        if (!isGroup) {
          updateQuery.$set = { status: "read" };
        }

        const message = await Message.findOneAndUpdate(
          {
            _id: messageId,
            "readBy.userId": { $ne: from }
          },
          updateQuery,
          { new: true }
        );

        if (!message) return;

        /**
         * Notify sender
         */
        const senderSocket = await redisClient.hGet("online_users", message.sender.toString());

        if (senderSocket) {

          socket.to(senderSocket).emit("msg-read-update", {
            messageId,
            status: message.status,
            newReader: readData
          });

        }

        /**
         * Group read receipts
         */
        if (isGroup) {
          io.to(to).emit("group-msg-read-update", {
            messageId,
            newReader: readData
          });
        }

      } catch (err) {
        console.error("Error atomically updating read status in DB:", err);
      }

    });

    /* =====================================================
       9. DELETE MESSAGE
       ===================================================== */

    socket.on("delete-msg", async (data, callback) => {

      if (data.isGroup) {
        socket.to(data.to).emit("msg-deleted", {
          messageId: data.messageId
        });
      } else {
        const receiverSocket = await redisClient.hGet("online_users", data.to);
        if (receiverSocket) {
          socket.to(receiverSocket).emit("msg-deleted", {
            messageId: data.messageId
          });
        }
      }

      if (callback) callback({ success: true, id: data.messageId });

    });

    /* =====================================================
       10. EDIT MESSAGE
       ===================================================== */

    socket.on("edit-msg", async (data, callback) => {

      if (data.isGroup) {
        socket.to(data.to).emit("msg-edited", {
          messageId: data.messageId,
          newText: data.newText
        });
      } else {
        const receiverSocket = await redisClient.hGet("online_users", data.to);
        if (receiverSocket) {
          socket.to(receiverSocket).emit("msg-edited", {
            messageId: data.messageId,
            newText: data.newText
          });
        }
      }

      if (callback) callback({ success: true, id: data.messageId });

    });

    /* =====================================================
       11. WEBRTC SIGNALING & CALL STATE MANAGEMENT
       ===================================================== */

    /**
     * Initiate call
     */
    socket.on("call-user", async (data) => {

      // Call State Management: Prevent calling a user who is already in a call
      const isUserBusy = await redisClient.hExists("active_calls", data.userToCall);
      
      if (isUserBusy) {
        socket.emit("call-rejected", { reason: "User is currently in another call." });
        return;
      }

      const receiverSocket = await redisClient.hGet("online_users", data.userToCall);

      if (receiverSocket) {
        
        // Mark both users as currently in a call in Redis
        await redisClient.hSet("active_calls", data.from, "true");
        await redisClient.hSet("active_calls", data.userToCall, "true");

        io.to(receiverSocket).emit("incoming-call", {
          signal: data.signalData,
          from: data.from,
          name: data.name,
          type: data.type
        });

      } else {

        socket.emit("call-rejected", {
          reason: "User is currently offline."
        });

      }

    });

    /**
     * Answer call
     */
    socket.on("answer-call", async (data) => {
      const callerSocket = await redisClient.hGet("online_users", data.to);
      if (callerSocket) {
        io.to(callerSocket).emit("call-accepted", data.signal);
      }
    });

    /**
     * ICE Candidate exchange
     */
    socket.on("ice-candidate", async (data) => {
      const targetSocket = await redisClient.hGet("online_users", data.target);
      if (targetSocket) {
        io.to(targetSocket).emit("ice-candidate-received", data.candidate);
      }
    });

    /**
     * End call
     */
    socket.on("end-call", async (data) => {
      
      // Clean up call states from Redis
      await redisClient.hDel("active_calls", data.to);
      if (socket.userId) await redisClient.hDel("active_calls", socket.userId);

      const targetSocket = await redisClient.hGet("online_users", data.to);

      if (targetSocket) {
        io.to(targetSocket).emit("call-ended", {
          reason: data.reason || "Call ended."
        });
      }

    });

    /* =====================================================
       12. DISCONNECT HANDLING
       ===================================================== */

    socket.on("disconnect", async () => {

      // STEP 1 FIX: Decrement active socket metric
      activeSocketsGauge.dec();

      const disconnectedUser = socket.userId;

      if (disconnectedUser) {

        // Remove from Redis State
        await redisClient.hDel("online_users", disconnectedUser);
        await redisClient.hDel("active_calls", disconnectedUser); // Just in case they dropped mid-call
        
        heartbeatThrottles.delete(disconnectedUser);

        const offlineTime = new Date();

        try {

          const user = await User.findByIdAndUpdate(
            disconnectedUser,
            {
              lastSeen: offlineTime,
              isOnline: false
            },
            { new: true }
          );

          // Broadcast updated list to all
          const onlineUsersArray = await redisClient.hKeys("online_users");
          io.emit("get-online-users", onlineUsersArray);

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

  });

};