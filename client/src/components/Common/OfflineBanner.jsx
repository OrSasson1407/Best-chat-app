import React, { useState, useEffect } from 'react';
import useChatStore from '../../store/chatStore';

const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const offlineQueueCount = useChatStore(state => state.offlineQueueCount);
  const loadOfflineQueueCount = useChatStore(state => state.loadOfflineQueueCount);

  useEffect(() => {
    // Initial load of queued items from disk
    loadOfflineQueueCount();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadOfflineQueueCount]);

  if (isOnline && offlineQueueCount === 0) return null;

  return (
    <div className={`w-full p-2 text-center text-sm text-white font-medium transition-colors duration-300 z-50 ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`}>
      {!isOnline ? (
        <span>
          You are offline. 
          {offlineQueueCount > 0 && ` ${offlineQueueCount} message(s) queued to send.`}
        </span>
      ) : (
        <span>Back online! Syncing {offlineQueueCount} messages...</span>
      )}
    </div>
  );
};

export default OfflineBanner;
