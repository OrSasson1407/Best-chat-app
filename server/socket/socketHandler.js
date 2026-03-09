const User = require("../models/User"); 
const Message = require("../models/Message");
const Group = require("../models/GroupModel"); // --- MERGE UPDATE: Imported Group model ---

module.exports = (io) => {
  // Use a map to track online users
  global.onlineUsers = new Map();
  
  // Track when we last wrote the heartbeat to the DB for each user
  const heartbeatThrottles = new Map();

  io.on("connection", (socket) => {
    
    // 1. User Online Status
    socket.on("add-user", async (userId) => {
      global.onlineUsers.set(userId, socket.id);
      socket.userId = userId; 
      
      // Let everyone know this socket ID is active (basic presence)
      io.emit("get-online-users", Array.from(global.onlineUsers.keys()));

      try {
         const user = await User.findByIdAndUpdate(userId, { isOnline: true }, { new: true });
         heartbeatThrottles.set(userId, Date.now());

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

    // Client requests the current status of a specific chat
    socket.on("check-presence", async (targetUserId) => {
      try {
          const user = await User.findById(targetUserId).select("lastSeen privacySettings");
          
          if (user?.privacySettings?.lastSeen === "nobody") {
              // Always pretend they are offline and have no last seen timestamp
              socket.emit("presence-response", { 
                  userId: targetUserId, 
                  isOnline: false, 
                  lastSeen: null 
              });
              return;
          }

          const isOnline = global.onlineUsers.has(targetUserId);
          if (isOnline) {
            socket.emit("presence-response", { userId: targetUserId, isOnline: true });
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

    // Heartbeat System
    socket.on("heartbeat", async (userId) => {
       global.onlineUsers.set(userId, socket.id); 
       
       const now = Date.now();
       const lastDbUpdate = heartbeatThrottles.get(userId) || 0;

       if (now - lastDbUpdate > 60000) {
           heartbeatThrottles.set(userId, now);
           try {
               await User.findByIdAndUpdate(userId, { lastSeen: new Date(now), isOnline: true });
           } catch (err) { 
               console.error("Heartbeat update failed", err); 
           }
       }
    });

    // 2. Join Group Room
    socket.on("join-group", (groupId) => {
      socket.join(groupId);
    });

    // 3. Send Message (Direct & Group)
    socket.on("send-msg", async (data, callback) => {
      if (data.isGroup) {
          
          // --- MERGE UPDATE: VERIFY CHANNEL POSTING PERMISSIONS ---
          try {
              const group = await Group.findById(data.to).select("isChannel admins moderators");
              if (group && group.isChannel) {
                  const isAllowed = group.admins.includes(data.from) || group.moderators.includes(data.from);
                  if (!isAllowed) {
                      if (callback) callback({ status: "error", msg: "Only admins and moderators can post in this channel." });
                      return; // Block message emit
                  }
              }
          } catch (err) {
              console.error("Error verifying channel permissions", err);
          }
          // --------------------------------------------------------

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
      } else {
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
                 await Message.findByIdAndUpdate(data.id, { status: "delivered" });
              } catch (err) {
                 console.error("Error updating delivered status:", err);
              }
              
              if (callback) callback({ status: "delivered", id: data.id });
          } else {
              if (callback) callback({ status: "sent", id: data.id });
          }
      }
    });

    // 4. Typing Indicator
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

    // 5. Emoji Reactions
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

    // 6. Handle Read Receipts
    socket.on("mark-as-read", async ({ messageId, from, to, isGroup, username }) => {
      try {
        const readerUser = await User.findById(from).select("privacySettings");
        
        // If readReceipts is false, DO NOT record the read or emit the event!
        if (readerUser && readerUser.privacySettings?.readReceipts === false) {
            return; 
        }

        const readData = { userId: from, username: username || "User", readAt: new Date() };
        
        const updateQuery = { $push: { readBy: readData } };
        
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

        const senderSocket = global.onlineUsers.get(message.sender.toString());
        if (senderSocket) {
            socket.to(senderSocket).emit("msg-read-update", { 
                messageId, 
                status: message.status,
                newReader: readData 
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

    // 7. Delete Message
    socket.on("delete-msg", (data, callback) => {
      if (data.isGroup) {
        socket.to(data.to).emit("msg-deleted", { messageId: data.messageId });
      } else {
        const receiverSocket = global.onlineUsers.get(data.to);
        if (receiverSocket) {
          socket.to(receiverSocket).emit("msg-deleted", { messageId: data.messageId });
        }
      }
      
      if (callback) callback({ success: true, id: data.messageId });
    });

    // 8. Edit Message 
    socket.on("edit-msg", (data, callback) => {
      if (data.isGroup) {
        socket.to(data.to).emit("msg-edited", { messageId: data.messageId, newText: data.newText });
      } else {
        const receiverSocket = global.onlineUsers.get(data.to);
        if (receiverSocket) {
          socket.to(receiverSocket).emit("msg-edited", { messageId: data.messageId, newText: data.newText });
        }
      }
      
      if (callback) callback({ success: true, id: data.messageId });
    });

    // --- WEBRTC SIGNALING ---

    socket.on("call-user", (data) => {
      const receiverSocket = global.onlineUsers.get(data.userToCall);
      if (receiverSocket) {
        io.to(receiverSocket).emit("incoming-call", {
          signal: data.signalData,
          from: data.from,
          name: data.name,
          type: data.type 
        });
      } else {
        socket.emit("call-rejected", { reason: "User is currently offline." });
      }
    });

    socket.on("answer-call", (data) => {
      const callerSocket = global.onlineUsers.get(data.to);
      if (callerSocket) {
        io.to(callerSocket).emit("call-accepted", data.signal);
      }
    });

    socket.on("ice-candidate", (data) => {
      const targetSocket = global.onlineUsers.get(data.target);
      if (targetSocket) {
        io.to(targetSocket).emit("ice-candidate-received", data.candidate);
      }
    });

    socket.on("end-call", (data) => {
      const targetSocket = global.onlineUsers.get(data.to);
      if (targetSocket) {
        io.to(targetSocket).emit("call-ended", { reason: data.reason || "Call ended." });
      }
    });

    // ----------------------------------------------------------

    // 9. Disconnect & Last Seen Update
    socket.on("disconnect", async () => {
      const disconnectedUser = socket.userId; 

      if (disconnectedUser) {
        global.onlineUsers.delete(disconnectedUser);
        heartbeatThrottles.delete(disconnectedUser); 
        
        const offlineTime = new Date();
        
        try {
          const user = await User.findByIdAndUpdate(disconnectedUser, { 
              lastSeen: offlineTime,
              isOnline: false
          }, { new: true });

          io.emit("get-online-users", Array.from(global.onlineUsers.keys()));

          if (user && user.privacySettings?.lastSeen !== "nobody") {
              io.emit("user-offline", { userId: disconnectedUser, lastSeen: offlineTime });
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