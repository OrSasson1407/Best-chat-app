const Message = require("../models/Message");
const User = require("../models/User");

module.exports = (io, redisClient) => {
  console.log("📡 Initializing MongoDB Change Streams...");

  try {
    // 1. Watch the Messages Collection
    const messageStream = Message.watch();

    // 🛑 CRASH PREVENTER: Handle stream errors (like not being a replica set)
    messageStream.on("error", (error) => {
        console.warn("⚠️ Message Stream disabled: MongoDB is likely not a Replica Set.");
    });

    messageStream.on("change", async (change) => {
      if (change.operationType === "insert") {
        const message = change.fullDocument;
        
        if (message.status === "sent" || message.status === "delivered") {
          const payload = {
            id: message._id,
            // FIX BUG 3: was `msg:` — renamed to `message:` to match the field name
            // the REST history fetch returns and that MessageItem reads.
            message: message.message.text,
            from: message.sender,
            to: message.users.find(u => u.toString() !== message.sender.toString()),
            isGroup: message.isGroupMsg || false,
            type: message.type,
            createdAt: message.createdAt,
            replyTo: message.replyTo,
            status: message.status,
            pollData: message.pollData,
            linkMetadata: message.linkMetadata,
            isForwarded: message.isForwarded,
            isViewOnce: message.isViewOnce,
            fileMetadata: message.fileMetadata
          };

          // FIX BUG 11: forEach with async callbacks doesn't await — use for...of
          for (const userId of message.users) {
            if (userId.toString() !== message.sender.toString()) {
              const receiverSockets = await redisClient.sMembers(`user_sockets:${userId.toString()}`);
              for (const socketId of receiverSockets) {
                io.to(socketId).emit("msg-recieve", payload);
              }
            }
          }
        }
      }

      if (change.operationType === "update") {
        const messageId = change.documentKey._id;
        const updatedFields = change.updateDescription.updatedFields;

        // FIX: Actually broadcast deletion updates that come through the change stream
        if (updatedFields.isDeleted === true) {
          const msg = await Message.findById(messageId).select("users sender");
          if (msg) {
            for (const userId of msg.users) {
              const userSockets = await redisClient.sMembers(`user_sockets:${userId.toString()}`);
              for (const socketId of userSockets) {
                io.to(socketId).emit("msg-deleted", { messageId });
              }
            }
          }
        }

        // Broadcast text edits that come through the change stream
        if (updatedFields["message.text"]) {
          const msg = await Message.findById(messageId).select("users");
          if (msg) {
            for (const userId of msg.users) {
              const userSockets = await redisClient.sMembers(`user_sockets:${userId.toString()}`);
              for (const socketId of userSockets) {
                io.to(socketId).emit("msg-edited", { messageId, newText: updatedFields["message.text"] });
              }
            }
          }
        }
      }
    });

    // 2. Watch the Users Collection
    const userStream = User.watch();
    
    // 🛑 CRASH PREVENTER
    userStream.on("error", (error) => {
        console.warn("⚠️ User Stream disabled: MongoDB is likely not a Replica Set.");
    });

    userStream.on("change", (change) => {
        if (change.operationType === "update" && change.updateDescription.updatedFields.avatarImage) {
            // io.emit("profile-picture-updated", { userId: change.documentKey._id })
        }
    });

  } catch (error) {
    console.error("⚠️ Change Streams failed to initialize:", error.message);
  }
};