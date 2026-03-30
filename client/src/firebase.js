/**
 * Firebase Client Configuration (Vite Version)
 * --------------------------------------------------------
 * Uses Vite environment variables (import.meta.env)
 * Handles:
 * - Firebase initialization
 * - FCM token generation
 * - Foreground message listener
 */

import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

/* =========================================================
   FIREBASE CONFIG (VITE ENV)
   ========================================================= */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/* =========================================================
   DEBUG (REMOVE AFTER VERIFY)
   ========================================================= */

console.log("🔥 Firebase Config Check:", {
  projectId: firebaseConfig.projectId,
  apiKey: firebaseConfig.apiKey ? "EXISTS" : "MISSING",
});

/* =========================================================
   INITIALIZE FIREBASE
   ========================================================= */

const app = initializeApp(firebaseConfig);

/* =========================================================
   MESSAGING SETUP
   ========================================================= */

export const messaging = getMessaging(app);

/* =========================================================
   REQUEST FCM TOKEN
   ========================================================= */

export const requestForToken = async () => {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("❌ Notification permission not granted.");
      return null;
    }

    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    if (currentToken) {
      console.log("✅ FCM Token:", currentToken);
      return currentToken;
    } else {
      console.warn("⚠️ No FCM token received.");
    }
  } catch (err) {
    console.error("❌ Error getting FCM token:", err);
  }

  return null;
};

/* =========================================================
   FOREGROUND MESSAGE LISTENER
   ========================================================= */

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("📩 Foreground message:", payload);
      resolve(payload);
    });
  });