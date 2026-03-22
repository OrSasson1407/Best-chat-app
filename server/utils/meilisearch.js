// server/utils/meilisearch.js
const { MeiliSearch } = require("meilisearch");

const meiliClient = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || "http://127.0.0.1:7700",
  apiKey: process.env.MEILISEARCH_API_KEY || "", // Leave empty for local dev without a master key
});

const userIndex = meiliClient.index("users");

// --- PHASE 3: NEW MESSAGES INDEX ---
const messageIndex = meiliClient.index("messages"); 

// Initialize Search Settings (ALL awaits MUST be inside this async function!)
const setupMeilisearch = async () => {
  try {
    // 1. Configure Users Index
    await userIndex.updateSearchableAttributes(["username", "email"]);
    await userIndex.updateRankingRules([
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ]);

    // 2. Configure Messages Index
    await messageIndex.updateSearchableAttributes(["text"]);
    // CRITICAL: This allows us to securely filter messages so users can only search their own chats
    await messageIndex.updateFilterableAttributes(["users"]);

    console.log("Meilisearch configured and ready.");
  } catch (error) {
    console.warn("Meilisearch setup warning (Is the service running?):", error.message);
  }
};

// Make sure messageIndex is exported so the messageController can use it!
module.exports = { meiliClient, userIndex, messageIndex, setupMeilisearch };