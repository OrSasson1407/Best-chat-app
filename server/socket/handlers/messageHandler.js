const Message = require("../../models/Message");
const Group = require("../../models/GroupModel");
const User = require("../../models/User");
const { notificationQueue } = require("../../workers/notificationWorker");
const { messageLatencyHistogram } = require("../../utils/metrics");

/**
 * DISTRIBUTED RATE LIMITER
 */
const isRateLimited = async (redisClient, socketId, action, limitMs) => {
  const key = `rate_limit:${socketId}:${action}`;
  const allowed = await redisClient.set(key, "1", { NX: true, PX: limitMs });
  return !allowed; 
};

/**
 * AUTOMATED CONTENT MODERATION
 */
function detectSpamOrMalicious(text) {
  if (!text) return false;
  const forbiddenPatterns = [
    /free.*crypto/i,
    /click.*here.*win/i,
    /http.*(phish|malware)\.com/i
  ];
  return forbiddenPatterns.some(regex => regex.test(text));
}

module.exports = (io, socket, redisClient) => {

  /* =====================================================
     1. SEND MESSAGE (DIRECT & GROUP)
     ===================================================== */
  socket.on("send-msg", async (data, callback) => {
    const startTime = Date.now(); 

    if (await isRateLimited(redisClient, socket.id, "send-msg", 200)) {
      if (callback) callback({ status: "error", msg: "Sending too fast." });
      return;
    }

    if (data.type === 'text' && detectSpamOrMalicious(data.msg)) {
      if (callback) callback({ status: "error", msg: "Message blocked by security filter." });
      return; 
    }

    // BUGFIX: The old message_ack here sent back data.id (whatever the client supplied)
    // before the DB write in the REST handler had completed. The triple-handshake then
    // mapped the wrong ID, corrupting optimistic UI state. The confirmed DB ID is now
    // returned exclusively via the REST response (addMessage → res.json({ data })).
    // The socket callback below still fires with "sent_to_server" status after routing.

    /** GROUP MESSAGE **/
    if (data.isGroup) {
      try {
        const group = await Group.findById(data.to).select("isChannel admins moderators");
        if (group && group.isChannel) {
          const isAllowed = group.admins.includes(data.from) || group.moderators.includes(data.from);
          if (!isAllowed) {
            if (callback) callback({ status: "error", msg: "Only admins and moderators can post in this channel." });
            return;
          }
        }
      } catch (err) {
        console.error("Error verifying channel permissions", err);
      }

      socket.to(data.to).emit("msg-recieve", {
        id: data.id,
        localId: data.localId,
        msg: data.msg,
        from: data.from,
        username: data.username,
        type: data.type,
        createdAt: new Date().toISOString(),
        isGroup: true,
        replyTo: data.replyTo,
        status: "sent_to_server",
        pollData: data.pollData,
        linkMetadata: data.linkMetadata,
        isForwarded: data.isForwarded,
        isViewOnce: data.isViewOnce,
        fileMetadata: data.fileMetadata
      });

      messageLatencyHistogram.observe(Date.now() - startTime);
      if (callback) callback({ status: "sent_to_server", id: data.id });
    }

    /** DIRECT MESSAGE **/
    else {
      // FIX: Fetch ALL active sockets for the receiving user
      const receiverSockets = await redisClient.sMembers(`user_sockets:${data.to}`);

      if (receiverSockets && receiverSockets.length > 0) {
        
        // FIX: Loop through and send the message to EVERY device the user has open
        receiverSockets.forEach(socketId => {
          socket.to(socketId).emit("msg-recieve", {
            id: data.id,
            localId: data.localId,
            msg: data.msg,
            from: data.from,
            type: data.type,
            createdAt: new Date().toISOString(),
            isGroup: false,
            replyTo: data.replyTo,
            status: "sent_to_server",
            pollData: data.pollData,
            linkMetadata: data.linkMetadata,
            isForwarded: data.isForwarded,
            isViewOnce: data.isViewOnce,
            fileMetadata: data.fileMetadata
          });
        });

        messageLatencyHistogram.observe(Date.now() - startTime);

        try {
          await Message.findByIdAndUpdate(data.id, { status: "sent_to_server" });
        } catch (err) {
          console.error("Error updating sent status:", err);
        }

        if (callback) callback({ status: "sent_to_server", id: data.id });
      } else {
        // RECIPIENT OFFLINE -> PUSH NOTIFICATION
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
        if (callback) callback({ status: "sent_to_server", id: data.id });
      }
    }
  });

  /* =====================================================
     2. DEVICE DELIVERY RECEIPTS (TRIPLE HANDSHAKE)
     ===================================================== */
  socket.on("message-delivered-receipt", async ({ messageId, from, to, isGroup }) => {
    try {
      if (!isGroup) {
        await Message.findByIdAndUpdate(messageId, { status: "delivered_to_device" });
      }
      
      // FIX: Notify all devices of the sender that the message was delivered
      const senderSockets = await redisClient.sMembers(`user_sockets:${from}`);
      if (senderSockets && senderSockets.length > 0) {
        senderSockets.forEach(socketId => {
          socket.to(socketId).emit("msg-delivery-update", {
            messageId,
            status: "delivered_to_device"
          });
        });
      }
    } catch (err) {
      console.error("Error updating delivery receipt:", err);
    }
  });

  /* =====================================================
     3. EMOJI REACTIONS
     ===================================================== */
  socket.on("send-reaction", async (data) => {
    if (data.isGroup) {
      socket.to(data.to).emit("receive-reaction", data);
    } else {
      // FIX: Send reaction to all of the recipient's devices
      const receiverSockets = await redisClient.sMembers(`user_sockets:${data.to}`);
      if (receiverSockets && receiverSockets.length > 0) {
        receiverSockets.forEach(socketId => {
          socket.to(socketId).emit("receive-reaction", data);
        });
      }
    }
  });

  /* =====================================================
     4. MESSAGE READ RECEIPTS
     ===================================================== */
  socket.on("mark-as-read", async ({ messageId, from, to, isGroup, username }) => {
    try {
      const readerUser = await User.findById(from).select("privacySettings");

      // Respect read receipt privacy
      if (readerUser && readerUser.privacySettings?.readReceipts === false) return;

      const readData = {
        userId: from,
        username: username || "User",
        readAt: new Date()
      };

      const updateQuery = { $push: { readBy: readData } };
      if (!isGroup) updateQuery.$set = { status: "read_by_user" };

      const message = await Message.findOneAndUpdate(
        { _id: messageId, "readBy.userId": { $ne: from } },
        updateQuery,
        { new: true }
      );

      if (!message) return;

      // FIX: Update read receipt on ALL of the original sender's devices
      const senderSockets = await redisClient.sMembers(`user_sockets:${message.sender.toString()}`);
      if (senderSockets && senderSockets.length > 0) {
        senderSockets.forEach(socketId => {
          socket.to(socketId).emit("msg-read-update", {
            messageId,
            status: message.status,
            newReader: readData
          });
        });
      }

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
     5. DELETE & EDIT MESSAGE
     ===================================================== */
  socket.on("delete-msg", async (data, callback) => {
    if (data.isGroup) {
      socket.to(data.to).emit("msg-deleted", { messageId: data.messageId });
    } else {
      // FIX: Delete message on all of recipient's devices
      const receiverSockets = await redisClient.sMembers(`user_sockets:${data.to}`);
      if (receiverSockets && receiverSockets.length > 0) {
        receiverSockets.forEach(socketId => socket.to(socketId).emit("msg-deleted", { messageId: data.messageId }));
      }
    }
    if (callback) callback({ success: true, id: data.messageId });
  });

  socket.on("edit-msg", async (data, callback) => {
    if (data.isGroup) {
      socket.to(data.to).emit("msg-edited", { messageId: data.messageId, newText: data.newText });
    } else {
      // FIX: Edit message on all of recipient's devices
      const receiverSockets = await redisClient.sMembers(`user_sockets:${data.to}`);
      if (receiverSockets && receiverSockets.length > 0) {
        receiverSockets.forEach(socketId => socket.to(socketId).emit("msg-edited", { messageId: data.messageId, newText: data.newText }));
      }
    }
    if (callback) callback({ success: true, id: data.messageId });
  });

};