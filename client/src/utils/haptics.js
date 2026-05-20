export const triggerHaptic = (type = 'default') => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  
  switch (type) {
    case 'message':
      navigator.vibrate(50); // Single soft pulse for new message
      break;
    case 'call':
      navigator.vibrate([500, 250, 500, 250, 500]); // Ringing pattern
      break;
    case 'error':
      navigator.vibrate([50, 100, 50]); // Aggressive double pulse for queueing offline
      break;
    default:
      navigator.vibrate(50);
  }
};
