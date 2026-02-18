const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messagesRoute");
const app = express();
const socket = require("socket.io");
require("dotenv").config();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// DB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log(err.message));

const server = app.listen(process.env.PORT, () =>
  console.log(`Server started on Port ${process.env.PORT}`)
);

// --- SOCKET.IO REAL-TIME LOGIC ---
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// Map to store online users: { "userId": "socketId" }
global.onlineUsers = new Map();

io.on("connection", (socket) => {
  // When a user logs in, store their socket ID mapped to their MongoDB ID
  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
  });

  // When a message is sent
  socket.on("send-msg", (data) => {
    const receiverSocket = onlineUsers.get(data.to);
    if (receiverSocket) {
      // Send the message AND the sender's ID to the recipient
      socket.to(receiverSocket).emit("msg-recieve", {
        msg: data.msg,
        from: data.from,
      });
    }
  });

  socket.on("disconnect", () => {
    onlineUsers.forEach((value, key) => {
      if (value === socket.id) onlineUsers.delete(key);
    });
  });
});