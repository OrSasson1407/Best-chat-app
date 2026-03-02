const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const groupRoutes = require("./routes/groupRoutes");
const app = express();
const socket = require("socket.io");
const User = require("./models/User"); 
const Message = require("./models/Message"); // Required Message model for DB updates
require("dotenv").config();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// DB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log(err.message));

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () =>
  console.log(`Server started on Port ${PORT}`)
);

// --- SOCKET.IO REAL-TIME LOGIC ---
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

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

  // 7. NEW: Delete Message (Real-time)
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

  // 8. NEW: Edit Message (Real-time)
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