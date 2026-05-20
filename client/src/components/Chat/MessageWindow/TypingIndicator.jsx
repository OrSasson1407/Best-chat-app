import React, { memo } from 'react';
import useChatStore from '../../../store/chatStore'; // ?? Fixed the import path (3 levels up)!

// ?? High Impact: Memoized component. The main MessageList will no longer re-render on every keystroke.
const TypingIndicator = memo(({ groupId }) => {
  const isTyping = useChatStore((state) => state.isTyping); // Ensure your store supports group-specific typing later
  const activeGroup = useChatStore((state) => state.activeGroup);

  // Only show if the typing event matches the current open group
  if (!isTyping || activeGroup !== groupId) return null;

  return (
    <div className="flex items-center space-x-1 p-2 text-sm text-gray-500 bg-transparent">
      <span className="italic">Someone is typing</span>
      <span className="flex space-x-1 ml-1">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </span>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';
export default TypingIndicator;
