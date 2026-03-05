const User = require("../models/User"); 
const Message = require("../models/Message");

module.exports = (io) => {
  // Use a map to track online users
  global.onlineUsers = new Map();

  io.on("connection", (socket) => {
    // 1. User Online Status
    socket.on("add-user", async (userId) => {
      onlineUsers.set(userId, socket.id);
      io.emit("get-online-users", Array.from(onlineUsers.keys()));
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
              status: "delivered"
          });
      } else {
          const receiverSocket = onlineUsers.get(data.to);
          if (receiverSocket) {
              socket.to(receiverSocket).emit("msg-recieve", {
                  id: data.id,
                  msg: data.msg,
                  from: data.from,
                  type: data.type,
                  createdAt: new Date().toISOString(),
                  isGroup: false,
                  replyTo: data.replyTo,
                  status: "delivered"
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
         const receiverSocket = onlineUsers.get(data.to);
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
            const receiverSocket = onlineUsers.get(data.to);
            if (receiverSocket) {
                socket.to(receiverSocket).emit("receive-reaction", data);
            }
        }
    });

    // 6. Handle Read Receipts (Blue Ticks)
    socket.on("mark-as-read", async ({ messageId, from, to }) => {
      try {
        // Save read status to database so it stays blue on refresh
        await Message.findByIdAndUpdate(messageId, { status: "read" });
      } catch (err) {
        console.error("Error updating read status in DB:", err);
      }

      // Notify the sender that their message was read
      const senderSocket = onlineUsers.get(from);
      if (senderSocket) {
        socket.to(senderSocket).emit("msg-read-update", { messageId });
      }
    });

    // 7. Delete Message (Real-time)
    socket.on("delete-msg", (data) => {
      if (data.isGroup) {
        socket.to(data.to).emit("msg-deleted", { messageId: data.messageId });
      } else {
        const receiverSocket = onlineUsers.get(data.to);
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
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
          socket.to(receiverSocket).emit("msg-edited", { messageId: data.messageId, newText: data.newText });
        }
      }
    });

    // 9. Disconnect & Last Seen Update
    socket.on("disconnect", async () => {
      let disconnectedUser = null;
      onlineUsers.forEach((value, key) => {
        if (value === socket.id) {
          disconnectedUser = key;
          onlineUsers.delete(key);
        }
      });

      if (disconnectedUser) {
        const offlineTime = new Date();
        
        try {
          await User.findByIdAndUpdate(disconnectedUser, { lastSeen: offlineTime });
        } catch (err) {
          console.error("Failed to update last seen:", err);
        }

        io.emit("get-online-users", Array.from(onlineUsers.keys()));
        io.emit("user-offline", { userId: disconnectedUser, lastSeen: offlineTime });
      }
    });
  });
};