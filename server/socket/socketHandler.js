const User = require("../models/User"); 
const Message = require("../models/Message");

module.exports = (io) => {
  // Use a map to track online users
  global.onlineUsers = new Map();

  io.on("connection", (socket) => {
    
    // 1. User Online Status
    socket.on("add-user", async (userId) => {
      global.onlineUsers.set(userId, socket.id);
      socket.userId = userId; // Attach userId to the socket object for easy access on disconnect
      
      io.emit("get-online-users", Array.from(global.onlineUsers.keys()));

      // Broadcast real-time presence
      socket.broadcast.emit("user-status-change", { 
        userId, 
        isOnline: true 
      });

      try {
         // Update the database to reflect they are online
         await User.findByIdAndUpdate(userId, { isOnline: true });
      } catch (err) {
         console.error("Failed to update online status:", err);
      }
    });

    // Client requests the current status of a specific chat
    socket.on("check-presence", async (targetUserId) => {
      const isOnline = global.onlineUsers.has(targetUserId);
      if (isOnline) {
        socket.emit("presence-response", { userId: targetUserId, isOnline: true });
      } else {
        try {
            // If offline, fetch their last seen time from the database
            const user = await User.findById(targetUserId).select("lastSeen");
            socket.emit("presence-response", { 
              userId: targetUserId, 
              isOnline: false, 
              lastSeen: user?.lastSeen || null 
            });
        } catch (err) {
            console.error("Failed to fetch presence:", err);
        }
      }
    });

    // Heartbeat System
    // The client sends this periodically to confirm they are still active
    socket.on("heartbeat", async (userId) => {
       global.onlineUsers.set(userId, socket.id); // Refresh mapping
       try {
           // Update last seen in the database silently
           await User.findByIdAndUpdate(userId, { lastSeen: new Date(), isOnline: true });
       } catch (err) { 
           console.error("Heartbeat update failed", err); 
       }
    });

    // 2. Join Group Room
    socket.on("join-group", (groupId) => {
      socket.join(groupId);
    });

    // 3. Send Message (Direct & Group)
    socket.on("send-msg", async (data) => {
      if (data.isGroup) {
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
              isViewOnce: data.isViewOnce
          });
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
                  isViewOnce: data.isViewOnce
              });

              // Automatically mark as delivered in DB if user is online
              try {
                 await Message.findByIdAndUpdate(data.id, { status: "delivered" });
              } catch (err) {
                 console.error("Error updating delivered status:", err);
              }
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

    // 6. Handle Read Receipts (Advanced Blue Ticks)
    socket.on("mark-as-read", async ({ messageId, from, to, isGroup, username }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Prevent duplicate reads by the same user
        const alreadyRead = message.readBy?.some(r => r.userId.toString() === from);
        
        if (!alreadyRead) {
            const readData = { userId: from, username: username || "User", readAt: new Date() };
            message.readBy.push(readData);
            
            // For direct messages, 1 read means fully read. 
            // For groups, we keep status as delivered until we implement a check for ALL members
            if (!isGroup) {
                message.status = "read";
            }
            await message.save();

            // Notify the original sender so their UI ticks turn blue instantly
            const senderSocket = global.onlineUsers.get(message.sender.toString());
            if (senderSocket) {
                socket.to(senderSocket).emit("msg-read-update", { 
                    messageId, 
                    status: message.status,
                    newReader: readData 
                });
            }

            // If it's a group, broadcast to the whole room so everyone's modals update
            if (isGroup) {
                io.to(to).emit("group-msg-read-update", { 
                    messageId, 
                    newReader: readData 
                });
            }
        }
      } catch (err) {
        console.error("Error updating read status in DB:", err);
      }
    });

    // 7. Delete Message (Real-time)
    socket.on("delete-msg", (data) => {
      if (data.isGroup) {
        socket.to(data.to).emit("msg-deleted", { messageId: data.messageId });
      } else {
        const receiverSocket = global.onlineUsers.get(data.to);
        if (receiverSocket) {
          socket.to(receiverSocket).emit("msg-deleted", { messageId: data.messageId });
        }
      }
    });

    // 8. Edit Message (Real-time)
    socket.on("edit-msg", (data) => {
      if (data.isGroup) {
        socket.to(data.to).emit("msg-edited", { messageId: data.messageId, newText: data.newText });
      } else {
        const receiverSocket = global.onlineUsers.get(data.to);
        if (receiverSocket) {
          socket.to(receiverSocket).emit("msg-edited", { messageId: data.messageId, newText: data.newText });
        }
      }
    });

    // --- MERGE UPDATE: WEBRTC SIGNALING (VOICE/VIDEO CALLS) ---

    // A. Initiate a call (Sends the initial WebRTC Offer)
    socket.on("call-user", (data) => {
      const receiverSocket = global.onlineUsers.get(data.userToCall);
      if (receiverSocket) {
        io.to(receiverSocket).emit("incoming-call", {
          signal: data.signalData,
          from: data.from,
          name: data.name,
          type: data.type // 'audio' or 'video'
        });
      } else {
        // User is offline, immediately tell the caller
        socket.emit("call-rejected", { reason: "User is currently offline." });
      }
    });

    // B. Answer the call (Sends the WebRTC Answer back to the caller)
    socket.on("answer-call", (data) => {
      const callerSocket = global.onlineUsers.get(data.to);
      if (callerSocket) {
        io.to(callerSocket).emit("call-accepted", data.signal);
      }
    });

    // C. Exchange ICE Candidates (Trickle ICE for network pathing)
    socket.on("ice-candidate", (data) => {
      const targetSocket = global.onlineUsers.get(data.target);
      if (targetSocket) {
        io.to(targetSocket).emit("ice-candidate-received", data.candidate);
      }
    });

    // D. End, Reject, or Cancel the call
    socket.on("end-call", (data) => {
      const targetSocket = global.onlineUsers.get(data.to);
      if (targetSocket) {
        io.to(targetSocket).emit("call-ended", { reason: data.reason || "Call ended." });
      }
    });

    // ----------------------------------------------------------

    // 9. Disconnect & Last Seen Update
    socket.on("disconnect", async () => {
      let disconnectedUser = socket.userId; // Prefer the explicitly attached ID
      
      // Fallback search if userId wasn't attached
      if (!disconnectedUser) {
        global.onlineUsers.forEach((value, key) => {
          if (value === socket.id) {
            disconnectedUser = key;
          }
        });
      }

      if (disconnectedUser) {
        global.onlineUsers.delete(disconnectedUser);
        const offlineTime = new Date();
        
        try {
          // Record offline time and status in DB
          await User.findByIdAndUpdate(disconnectedUser, { 
              lastSeen: offlineTime,
              isOnline: false
          });
        } catch (err) {
          console.error("Failed to update last seen:", err);
        }

        io.emit("get-online-users", Array.from(global.onlineUsers.keys()));
        io.emit("user-offline", { userId: disconnectedUser, lastSeen: offlineTime });

        // Tell active chats this user just went offline
        socket.broadcast.emit("user-status-change", { 
          userId: disconnectedUser, 
          isOnline: false,
          lastSeen: offlineTime.toISOString()
        });
      }
    });
  });
};