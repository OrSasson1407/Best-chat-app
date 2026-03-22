module.exports = (io, socket, redisClient) => {

  /* =====================================================
     1. INITIATE CALL
     ===================================================== */
  socket.on("call-user", async (data) => {
    // Call State Management: Prevent calling a user who is already in a call
    const isUserBusy = await redisClient.hExists("active_calls", data.userToCall);
    
    if (isUserBusy) {
      socket.emit("call-rejected", { reason: "User is currently in another call." });
      return;
    }

    const receiverSocket = await redisClient.hGet("online_users", data.userToCall);

    if (receiverSocket) {
      // Mark both users as currently in a call in Redis
      await redisClient.hSet("active_calls", data.from, "true");
      await redisClient.hSet("active_calls", data.userToCall, "true");

      io.to(receiverSocket).emit("incoming-call", {
        signal: data.signalData,
        from: data.from,
        name: data.name,
        type: data.type
      });
    } else {
      socket.emit("call-rejected", {
        reason: "User is currently offline."
      });
    }
  });

  /* =====================================================
     2. ANSWER CALL
     ===================================================== */
  socket.on("answer-call", async (data) => {
    const callerSocket = await redisClient.hGet("online_users", data.to);
    if (callerSocket) {
      io.to(callerSocket).emit("call-accepted", data.signal);
    }
  });

  /* =====================================================
     3. ICE CANDIDATE EXCHANGE
     ===================================================== */
  socket.on("ice-candidate", async (data) => {
    const targetSocket = await redisClient.hGet("online_users", data.target);
    if (targetSocket) {
      io.to(targetSocket).emit("ice-candidate-received", data.candidate);
    }
  });

  /* =====================================================
     4. END CALL
     ===================================================== */
  socket.on("end-call", async (data) => {
    // Clean up call states from Redis
    await redisClient.hDel("active_calls", data.to);
    if (socket.userId) await redisClient.hDel("active_calls", socket.userId);

    const targetSocket = await redisClient.hGet("online_users", data.to);

    if (targetSocket) {
      io.to(targetSocket).emit("call-ended", {
        reason: data.reason || "Call ended."
      });
    }
  });

};