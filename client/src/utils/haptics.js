/**
 * Triggers device haptic feedback if supported by the browser/device.
 * @param {'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'} type 
 */
export const triggerHaptic = (type = 'light') => {
    // Check if the vibration API is supported (fails gracefully on iOS/desktop)
    if (typeof window === 'undefined' || !navigator.vibrate) return;
  
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(10); // Short, subtle tap (e.g., swipe threshold met)
          break;
        case 'medium':
          navigator.vibrate(20); // Standard tap (e.g., opening a menu)
          break;
        case 'heavy':
          navigator.vibrate(40); // Hard tap (e.g., deleting a message)
          break;
        case 'success':
          navigator.vibrate([10, 30, 20]); // Double tap (e.g., message sent)
          break;
        case 'warning':
          navigator.vibrate([30, 40, 30]); // Buzz-pause-buzz (e.g., offline)
          break;
        case 'error':
          navigator.vibrate([50, 50, 50, 50, 50]); // Aggressive pulsing
          break;
        default:
          navigator.vibrate(10);
      }
    } catch (error) {
      console.warn("Haptics failed or blocked by browser settings.", error);
    }
  };