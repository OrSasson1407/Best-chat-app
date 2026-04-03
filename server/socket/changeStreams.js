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
            msg: message.message.text,
            from: message.sender,
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

          // FIX: Use user_sockets Set (multi-device) — online_users Hash is never written.
          // forEach with async callbacks doesn't await properly; use for...of instead.
          for (const userId of message.users) {
            if (userId.toString() !== message.sender.toString()) {
              const receiverSockets = await redisClient.sMembers(`user_sockets:${userId.toString()}`);
              receiverSockets.forEach(socketId => {
                io.to(socketId).emit("msg-recieve", payload);
              });
            }
          }
        }
      }

      if (change.operationType === "update") {
        const messageId = change.documentKey._id;
        const updatedFields = change.updateDescription.updatedFields;

        if (updatedFields.isDeleted === true) {
           // Example implementation
           // io.emit("msg-deleted", { messageId });
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