// server/utils/meilisearch.js
const { MeiliSearch } = require("meilisearch");

// Initialize the Meilisearch client
const meiliClient = new MeiliSearch({
  // This will use your Render environment variable in production, 
  // and fall back to localhost for your local development.
  host: process.env.MEILISEARCH_HOST || "http://127.0.0.1:7700",
  apiKey: process.env.MEILISEARCH_API_KEY || "", 
});

// Identify the indexes
const userIndex = meiliClient.index("users");
const messageIndex = meiliClient.index("messages"); 

/**
 * Initialize Search Settings
 * This function is called in server/index.js during the startup process.
 */
const setupMeilisearch = async () => {
  const host = process.env.MEILISEARCH_HOST || "http://127.0.0.1:7700";
  
  try {
    console.log(`🔍 Connecting to Meilisearch at: ${host}`);

    // 1. Configure Users Index (Settings for searching people)
    await userIndex.updateSearchableAttributes(["username", "email"]);
    await userIndex.updateRankingRules([
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ]);

    // 2. Configure Messages Index (Settings for searching chats)
    await messageIndex.updateSearchableAttributes(["text"]);
    
    // CRITICAL: This allows us to securely filter messages 
    // so users can only search their own chats, not everyone's.
    await messageIndex.updateFilterableAttributes(["users"]);

    console.log("✅ Meilisearch Cloud configured and ready.");
  } catch (error) {
    // If this fails, the app will still run, but search won't work.
    console.warn("⚠️ Meilisearch setup warning:", error.message);
  }
};

// Export the client and indexes for use in your Controllers
module.exports = { meiliClient, userIndex, messageIndex, setupMeilisearch };