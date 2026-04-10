import React from "react";

export default function OfflineBanner({ isOffline }) {
  if (!isOffline) return null;

  return (
    <div className="offline-banner">
      <span className="dot" />
      You're offline — messages will sync when reconnected
    </div>
  );
}
