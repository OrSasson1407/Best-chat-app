const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const initializeFirebase = () => {
  // 1. Singleton Pattern Check
  // Prevents "app already exists" errors if this file is required multiple times
  if (admin.apps.length > 0) {
    return;
  }

  try {
    // 2. Environment-Based Credentials (Production / Render)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // NOTE: Render sometimes escapes newlines in JSON strings. 
      // We safely parse it here.
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      console.log("🔥 Firebase Admin Initialized successfully from environment variables.");
      return;
    }

    // 3. Local File Fallback (Development)
    const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      console.log("🔥 Firebase Admin Initialized successfully from local file.");
      return;
    } 

    // 4. No Credentials Found
    console.warn("⚠️ Firebase credentials not found (Env var or local file). Push notifications are disabled.");
    
  } catch (error) {
    // 5. Error Handling
    // Catches JSON parsing errors or expired credentials so the server doesn't crash on startup.
    console.error("❌ Failed to initialize Firebase Admin:", error.message);
  }
};

// Execute the initialization logic
initializeFirebase();

module.exports = admin;