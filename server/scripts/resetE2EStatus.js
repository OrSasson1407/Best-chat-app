/**
 * ONE-TIME MIGRATION SCRIPT
 * ─────────────────────────────────────────────────────────────
 * Run this ONCE after deploying the E2E key fixes to reset
 * all users who have invalid/empty e2eKeys in the DB.
 *
 * These are users whose keys were "uploaded" before the
 * { bundle } → { ...bundle } fix, meaning the server received
 * undefined for all fields and saved an empty e2eKeys object.
 *
 * What it does:
 *   - Finds all users where e2eKeys.identityKey is empty or missing
 *   - Sets e2eStatus.hasKeys = false, e2eStatus.enabled = false
 *   - On their next login, Login.jsx will detect !serverHasKeys
 *     and automatically regenerate + re-upload valid keys
 *
 * Usage:
 *   cd server
 *   MONGO_URI=<your_uri> node scripts/resetE2EStatus.js
 * ─────────────────────────────────────────────────────────────
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  "mongodb://127.0.0.1:27017/chat-app";

// Inline schema — avoids importing the full model with all its hooks
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", userSchema);

async function run() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("✅ Connected\n");

  // Find users with missing or empty identityKey
  const invalidUsers = await User.find({
    $or: [
      { "e2eKeys.identityKey": { $exists: false } },
      { "e2eKeys.identityKey": "" },
      { "e2eKeys.identityKey": null },
    ],
  }).select("_id username e2eKeys e2eStatus");

  console.log(`Found ${invalidUsers.length} users with invalid/empty E2E keys:\n`);

  if (invalidUsers.length === 0) {
    console.log("🎉 Nothing to fix — all users have valid keys.");
    await mongoose.disconnect();
    return;
  }

  for (const user of invalidUsers) {
    console.log(
      `  → ${user.username || user._id}  |  identityKey: "${user.e2eKeys?.identityKey || "(missing)"}"`
    );
  }

  console.log("\n🔄 Resetting e2eStatus.hasKeys = false for these users...");

  const result = await User.updateMany(
    {
      $or: [
        { "e2eKeys.identityKey": { $exists: false } },
        { "e2eKeys.identityKey": "" },
        { "e2eKeys.identityKey": null },
      ],
    },
    {
      $set: {
        "e2eStatus.hasKeys": false,
        "e2eStatus.enabled": false,
      },
    }
  );

  console.log(`\n✅ Done. Updated ${result.modifiedCount} users.`);
  console.log(
    "\nThese users will automatically get new keys generated\n" +
    "the next time they log in — no action needed from them.\n"
  );

  await mongoose.disconnect();
  console.log("🔌 Disconnected.");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});