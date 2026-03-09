// client/src/index.js
import process from 'process';
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// 1. SAFE POLYFILL ASSIGNMENT
// Only assign process to the window object if it doesn't already exist.
if (typeof window !== 'undefined') {
  window.process = window.process || process;
}

// 2. STANDARD REACT RENDER LOGIC
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 3. FRONTEND IMPROVEMENT: SERVICE WORKER REGISTRATION
// This enables Firebase Push Notifications and PWA capabilities.
// We only register it in production to avoid caching issues during local development.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    // Registering the specific Firebase service worker from your public folder
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}