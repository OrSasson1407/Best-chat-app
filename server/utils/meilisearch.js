const { MeiliSearch } = require("meilisearch");

const meiliClient = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || "http://127.0.0.1:7700",
  apiKey: process.env.MEILISEARCH_API_KEY || "", // Leave empty for local dev without a master key
});

const userIndex = meiliClient.index("users");

// Initialize Search Settings
const setupMeilisearch = async () => {
  try {
    // We only want users to be searchable by their username or email
    await userIndex.updateSearchableAttributes(["username", "email"]);
    // Sort results to prioritize exact matches on the username
    await userIndex.updateRankingRules([
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ]);
    console.log("Meilisearch configured and ready.");
  } catch (error) {
    console.warn("Meilisearch setup warning (Is the service running?):", error.message);
  }
};

module.exports = { meiliClient, userIndex, setupMeilisearch };