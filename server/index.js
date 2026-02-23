const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const groupRoutes = require("./routes/groupRoutes"); // Include the group routes we added
const app = express();
const socket = require("socket.io");
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

// FIXED: Add '|| 5000' to ensure it runs on 5000 even if .env is missing
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
  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("get-online-users", Array.from(onlineUsers.keys()));
  });

  // 2. Join Group Room
  socket.on("join-group", (groupId) => {
    socket.join(groupId);
  });

  // 3. Send Message (Direct & Group)
  socket.on("send-msg", (data) => {
    // If it is a group message, broadcast to the Room
    if (data.isGroup) {
        socket.to(data.to).emit("msg-recieve", {
            msg: data.msg,
            from: data.from,
            username: data.username, // Send sender name
            type: data.type,
            createdAt: new Date().toISOString(),
            isGroup: true
        });
    } else {
        // Direct Message Logic
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            socket.to(receiverSocket).emit("msg-recieve", {
                msg: data.msg,
                from: data.from,
                type: data.type,
                createdAt: new Date().toISOString(),
                isGroup: false
            });
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

  // 5. Disconnect
  socket.on("disconnect", () => {
    let disconnectedUser = null;
    onlineUsers.forEach((value, key) => {
      if (value === socket.id) {
        disconnectedUser = key;
        onlineUsers.delete(key);
      }
    });
    if (disconnectedUser) {
      io.emit("get-online-users", Array.from(onlineUsers.keys()));
    }
  });
});