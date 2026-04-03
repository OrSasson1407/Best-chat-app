const Group = require("../../models/GroupModel");
const { typingSchema } = require("../../utils/validation");

/**
 * DISTRIBUTED RATE LIMITER
 */
const isRateLimited = async (redisClient, socketId, action, limitMs) => {
  const key = `rate_limit:${socketId}:${action}`;
  const allowed = await redisClient.set(key, "1", { NX: true, PX: limitMs });
  return !allowed; 
};

module.exports = (io, socket, redisClient) => {

  /* =====================================================
     1. GROUP ROOM JOIN
     ===================================================== */
  socket.on("join-group", async (groupId) => {
    try {
      const group = await Group.findById(groupId).select("users");
      
      // Strict Room Validation: Make sure the user is actually a member of the group
      // FIX: Group schema field is `members`, not `users`. The wrong field name
      // meant the check always failed, so no socket ever joined the group room,
      // and real-time group messages were never delivered to anyone.
      if (group && group.members.map(id => id.toString()).includes(socket.userId)) {
        socket.join(groupId);
      } else {
        socket.emit("error-msg", { message: "You are not authorized to join this group." });
      }
    } catch (err) {
      console.error("Error joining group room:", err);
    }
  });

  /* =====================================================
     2. TYPING INDICATOR (GROUPS & DIRECT)
     ===================================================== */
  socket.on("typing", async (rawData) => {
    // 1. Validate payload
    const { error, value: data } = typingSchema.validate(rawData);
    if (error) return console.error("Invalid typing payload:", error.details[0].message);

    // Throttle typing indicators to save bandwidth (max 1 event per 800ms) using Redis
    if (await isRateLimited(redisClient, socket.id, "typing", 800)) return;

    if (data.isGroup) {
      socket.to(data.to).emit("typing-status", {
        from: data.from,
        isTyping: data.isTyping,
        isGroup: true,
        username: data.username
      });
    } else {
      const receiverSocket = await redisClient.hGet("online_users", data.to);

      if (receiverSocket) {
        socket.to(receiverSocket).emit("typing-status", {
          from: data.from,
          isTyping: data.isTyping
        });
      }
    }
  });

};