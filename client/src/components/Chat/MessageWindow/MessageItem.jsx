import React, { memo, useEffect, useState } from 'react';

const MessageItem = memo(({ message, isOwnMessage }) => {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // 🔥 High Impact: Remove will-change after animation completes to save GPU memory
    const timer = setTimeout(() => setIsAnimating(false), 300); 
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`flex w-full mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      style={isAnimating ? { willChange: 'transform, opacity' } : {}}
    >
      <div className={`max-w-[70%] p-3 rounded-lg ${isOwnMessage ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'} transition-transform duration-300 ease-out`}>
        <p className="break-words">{message.content}</p>
        <span className="text-xs opacity-75 mt-1 block text-right">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';
export default MessageItem;
