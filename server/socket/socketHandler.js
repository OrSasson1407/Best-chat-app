/**
 * Socket Handler
 * ---------------------------------------------------------
 * This module defines all real-time communication logic
 * using Socket.io for the chat backend.
 *
 * Responsibilities:
 * - Track online users
 * - Handle real-time messaging (direct + group)
 * - Typing indicators
 * - Emoji reactions
 * - Message read receipts
 * - Message editing & deletion
 * - Presence system (online / last seen)
 * - Heartbeat system for active sessions
 * - WebRTC signaling for voice/video calls
 *
 * This file acts as the **central real-time event hub**
 * of the chat application.
 */

const User = require("../models/User");
const Message = require("../models/Message");
const Group = require("../models/GroupModel"); // Group chat model


/**
 * Initialize Socket Event Handlers
 *
 * @param {SocketIO.Server} io - Socket.io server instance
 */
module.exports = (io) => {

  /**
   * Global Map to track online users
   *
   * Key   → userId
   * Value → socketId
   */
  global.onlineUsers = new Map();


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

    /* =====================================================
       1. USER ONLINE STATUS
       ===================================================== */

    /**
     * Register user when they connect
     */
    socket.on("add-user", async (userId) => {

      // Save socketId for the user
      global.onlineUsers.set(userId, socket.id);

      socket.userId = userId;

      /**
       * Broadcast list of online users
       */
      io.emit("get-online-users", Array.from(global.onlineUsers.keys()));

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

        const isOnline = global.onlineUsers.has(targetUserId);

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

      global.onlineUsers.set(userId, socket.id);

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
     * Allows user to join group room
     */
    socket.on("join-group", (groupId) => {

      socket.join(groupId);

    });


    /* =====================================================
       5. SEND MESSAGE (DIRECT & GROUP)
       ===================================================== */

    socket.on("send-msg", async (data, callback) => {

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

        if (callback) callback({ status: "sent", id: data.id });

      }

      /**
       * DIRECT MESSAGE
       */
      else {

        const receiverSocket = global.onlineUsers.get(data.to);

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

          if (callback) callback({ status: "sent", id: data.id });

        }

      }

    });


    /* =====================================================
       6. TYPING INDICATOR
       ===================================================== */

    socket.on("typing", (data) => {

      if (data.isGroup) {

        socket.to(data.to).emit("typing-status", {

          from: data.from,
          isTyping: data.isTyping,

          isGroup: true,
          username: data.username

        });

      } else {

        const receiverSocket = global.onlineUsers.get(data.to);

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

    socket.on("send-reaction", (data) => {

      if (data.isGroup) {

        socket.to(data.to).emit("receive-reaction", data);

      } else {

        const receiverSocket = global.onlineUsers.get(data.to);

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
        const senderSocket =
          global.onlineUsers.get(message.sender.toString());

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

    socket.on("delete-msg", (data, callback) => {

      if (data.isGroup) {

        socket.to(data.to).emit("msg-deleted", {
          messageId: data.messageId
        });

      } else {

        const receiverSocket = global.onlineUsers.get(data.to);

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

    socket.on("edit-msg", (data, callback) => {

      if (data.isGroup) {

        socket.to(data.to).emit("msg-edited", {
          messageId: data.messageId,
          newText: data.newText
        });

      } else {

        const receiverSocket = global.onlineUsers.get(data.to);

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
       11. WEBRTC SIGNALING
       ===================================================== */

    /**
     * Initiate call
     */
    socket.on("call-user", (data) => {

      const receiverSocket =
        global.onlineUsers.get(data.userToCall);

      if (receiverSocket) {

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
    socket.on("answer-call", (data) => {

      const callerSocket =
        global.onlineUsers.get(data.to);

      if (callerSocket) {

        io.to(callerSocket).emit("call-accepted", data.signal);

      }

    });


    /**
     * ICE Candidate exchange
     */
    socket.on("ice-candidate", (data) => {

      const targetSocket =
        global.onlineUsers.get(data.target);

      if (targetSocket) {

        io.to(targetSocket).emit(
          "ice-candidate-received",
          data.candidate
        );

      }

    });


    /**
     * End call
     */
    socket.on("end-call", (data) => {

      const targetSocket =
        global.onlineUsers.get(data.to);

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

      const disconnectedUser = socket.userId;

      if (disconnectedUser) {

        global.onlineUsers.delete(disconnectedUser);
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

          io.emit(
            "get-online-users",
            Array.from(global.onlineUsers.keys())
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

  });

};