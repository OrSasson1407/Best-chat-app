const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const initializeFirebase = () => {
  // 1. IMPROVEMENT: Singleton Pattern Check
  // Prevents "app already exists" errors if this file is required multiple times
  if (admin.apps.length > 0) {
    return;
  }

  try {
    // 2. IMPROVEMENT: Environment-Based Credentials
    // Allows injecting credentials in production (Docker, Heroku, Vercel) without committing the JSON file.
    // Example: process.env.FIREBASE_SERVICE_ACCOUNT = '{"type": "service_account", "project_id": "...", ...}'
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("🔥 Firebase Admin Initialized successfully from environment variables.");
      return;
    }

    // Fallback to local file for development
    // Adjusted path to point to the server root where the key should reside
    const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("🔥 Firebase Admin Initialized successfully from local file.");
    } else {
      console.log("⚠️ Firebase credentials not found (Env var or local file). Push notifications are disabled.");
    }
    
  } catch (error) {
    // 3. IMPROVEMENT: Error Handling
    // Catches JSON parsing errors or expired credentials so the server doesn't crash on startup.
    console.error("❌ Failed to initialize Firebase Admin:", error.message);
  }
};

// Execute the initialization logic
initializeFirebase();

module.exports = admin;