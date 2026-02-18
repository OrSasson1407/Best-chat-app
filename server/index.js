const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const app = express();
const socket = require("socket.io");
require("dotenv").config();

app.use(cors());

// INCREASED LIMIT: Essential for sending Base64 Images/Audio
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log(err.message));

// Server Setup
const server = app.listen(process.env.PORT, () =>
  console.log(`Server started on Port ${process.env.PORT}`)
);

// Socket.io Setup
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// Global Map: UserId -> SocketId
global.onlineUsers = new Map();

io.on("connection", (socket) => {
  
  // 1. User Online Status
  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("get-online-users", Array.from(onlineUsers.keys()));
  });

  // 2. Send Message (Text, Image, Audio)
  socket.on("send-msg", (data) => {
    const receiverSocket = onlineUsers.get(data.to);
    if (receiverSocket) {
      socket.to(receiverSocket).emit("msg-recieve", {
        msg: data.msg,
        from: data.from,
        type: data.type, // Broadcast the type (text/image/audio)
        createdAt: new Date().toISOString(), // Server-side timestamp
      });
    }
  });

  // 3. Typing Indicator
  socket.on("typing", (data) => {
    const receiverSocket = onlineUsers.get(data.to);
    if (receiverSocket) {
      socket.to(receiverSocket).emit("typing-status", {
        from: data.from,
        isTyping: data.isTyping,
      });
    }
  });

  // 4. Disconnect
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