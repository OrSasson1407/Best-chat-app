// Import Firebase Scripts for Service Workers
importScripts("https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging-compat.js");

// Initialize Firebase App inside the Service Worker
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

// Background Message Handler
messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/logo192.png", // Replace with your app's logo path
    badge: "/logo192.png",
    data: payload.data, // Contains the userId/chatId to open when clicked
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

// Handle Notification Clicks (When user clicks the popup, open the chat app)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Focus the window if it's already open, otherwise open a new window
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});