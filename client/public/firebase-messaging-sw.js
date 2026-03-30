/**
 * Firebase Messaging Service Worker
 * --------------------------------------------------------
 * Handles background push notifications using Firebase Cloud Messaging (FCM)
 *
 * IMPORTANT:
 * - This file runs in a Service Worker context (NO import.meta.env)
 * - Firebase config MUST be hardcoded here
 * - This file MUST be in your public root (e.g. /public)
 */

// Import Firebase (compat version required for service workers)
importScripts("https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging-compat.js");

/* =========================================================
   FIREBASE INITIALIZATION (HARDCODED CONFIG)
   ========================================================= */

firebase.initializeApp({
  apiKey: "AIzaSyB6-DkN_SS_zYptxETmWlG29Uc8jQ7fuiI",
  authDomain: "chat-app-or.firebaseapp.com",
  projectId: "chat-app-or",
  storageBucket: "chat-app-or.firebasestorage.app",
  messagingSenderId: "152961488891",
  appId: "1:152961488891:web:4700c9f9c7fc71984b9d5e",
});

/* =========================================================
   FIREBASE MESSAGING INSTANCE
   ========================================================= */

const messaging = firebase.messaging();

/* =========================================================
   BACKGROUND MESSAGE HANDLER
   ========================================================= */

/**
 * Triggered when a push notification is received
 * while the app is in the background or closed
 */
messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw.js] Background message:", payload);

  const notificationTitle = payload?.notification?.title || "New Message";
  const notificationOptions = {
    body: payload?.notification?.body || "You have a new notification",
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: payload?.data || {}, // used for navigation on click
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

/* =========================================================
   NOTIFICATION CLICK HANDLER
   ========================================================= */

/**
 * Handles user clicking on the notification
 * - Focuses existing tab OR opens a new one
 */
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl = "/"; // you can customize this later

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

/* =========================================================
   OPTIONAL: INSTALL & ACTIVATE (FOR DEBUGGING)
   ========================================================= */

self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activated");
});