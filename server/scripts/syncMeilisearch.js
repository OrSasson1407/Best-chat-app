require("dotenv").config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require("mongoose");
const User = require("../models/User");
const Message = require("../models/Message");
const { userIndex, messageIndex, setupMeilisearch } = require("../utils/meilisearch");

const BATCH_SIZE = 1000;

const syncDatabaseToMeili = async () => {
  try {
    console.log("🚀 Starting Meilisearch Synchronization...");

    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGO_URL);
    console.log("✅ Connected to MongoDB.");

    // 2. Ensure Meili Settings are applied
    await setupMeilisearch();

    // ==========================================
    // SYNC USERS
    // ==========================================
    console.log("🔄 Syncing Users...");
    const totalUsers = await User.countDocuments();
    let usersProcessed = 0;

    for (let i = 0; i < totalUsers; i += BATCH_SIZE) {
      const users = await User.find().skip(i).limit(BATCH_SIZE).select("_id username email");
      
      const userDocuments = users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        email: u.email
      }));

      if (userDocuments.length > 0) {
        await userIndex.addDocuments(userDocuments);
      }
      
      usersProcessed += userDocuments.length;
      console.log(`   -> Processed ${usersProcessed} / ${totalUsers} users`);
    }

    // ==========================================
    // SYNC MESSAGES
    // ==========================================
    console.log("🔄 Syncing Messages...");
    // Only index text and link messages (media doesn't have searchable text)
    const messageQuery = { isDeleted: false, type: { $in: ["text", "link"] } };
    const totalMessages = await Message.countDocuments(messageQuery);
    let messagesProcessed = 0;

    for (let i = 0; i < totalMessages; i += BATCH_SIZE) {
      const messages = await Message.find(messageQuery).skip(i).limit(BATCH_SIZE).select("_id message.text users sender createdAt");
      
      const messageDocuments = messages.map(m => ({
        id: m._id.toString(),
        text: m.message?.text || "",
        users: m.users.map(u => u.toString()), // Array of users allowed to search this
        sender: m.sender.toString(),
        createdAt: new Date(m.createdAt).getTime()
      }));

      if (messageDocuments.length > 0) {
        await messageIndex.addDocuments(messageDocuments);
      }

      messagesProcessed += messageDocuments.length;
      console.log(`   -> Processed ${messagesProcessed} / ${totalMessages} messages`);
    }

    console.log("✅ Synchronization Complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Synchronization Failed:", error.message);
    process.exit(1);
  }
};

syncDatabaseToMeili();