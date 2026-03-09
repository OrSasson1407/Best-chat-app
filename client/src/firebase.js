import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// You get these from your Firebase Console (Project Settings > General > Web App)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// Function to request permission and get the FCM Token
export const requestForToken = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const currentToken = await getToken(messaging, {
        // Inserted your actual VAPID key below
        vapidKey: "BLTI7YK1uNflECmf4NzngSKdenI_IkLv9DPkGaE9tel8L9CppzfXc5u7ghMbRkcJKbFLmsPIokleCgNblgSvu5o" 
      });
      if (currentToken) {
        return currentToken;
      } else {
        console.log("No registration token available. Request permission to generate one.");
      }
    } else {
      console.log("Permission not granted for Notification.");
    }
  } catch (err) {
    console.error("An error occurred while retrieving token. ", err);
  }
  return null;
};

// Listen for foreground messages
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });