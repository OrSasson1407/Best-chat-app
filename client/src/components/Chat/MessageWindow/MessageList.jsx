import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import useChatStore from '../../../../store/chatStore';

const MessageList = ({ activeGroupId }) => {
  const messages = useChatStore((state) => state.messages);
  // Assuming auth data is available or passed down; adjust based on your actual auth store
  const currentUserId = "current-user-id"; 
  
  const [showScrollButton, setShowScrollButton] = useState(false);
  const virtuosoRef = useRef(null);

  // 🔥 High Impact: Storing context in a ref prevents the itemRenderer from changing identity 
  // and forcing Virtuoso to remount all visible rows when non-message state changes.
  const contextRef = useRef({ currentUserId });
  useEffect(() => {
    contextRef.current = { currentUserId };
  }, [currentUserId]);

  const itemRenderer = useCallback((index, message) => {
    // Safely check against populated object or string ID
    const senderIdStr = typeof message.senderId === 'object' ? message.senderId._id : message.senderId;
    const isOwnMessage = senderIdStr === contextRef.current.currentUserId;
    
    return <MessageItem message={message} isOwnMessage={isOwnMessage} />;
  }, []);

  const handleScroll = (e) => {
    const isNearBottom = e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight < 150;
    setShowScrollButton(!isNearBottom);
  };

  const scrollToBottom = () => {
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
  };

  return (
    <div className="flex-1 relative flex flex-col bg-white overflow-hidden">
      <div className="flex-1 h-full" onScroll={handleScroll}>
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          itemContent={itemRenderer}
          // 🔥 High Impact: Pre-renders rows 300px above and below viewport
          increaseViewportBy={300} 
          initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
          followOutput="smooth"
          className="w-full h-full p-4"
        />
      </div>

      <TypingIndicator groupId={activeGroupId} />

      {/* 🔥 High Impact: Dropped framer-motion AnimatePresence for a pure CSS transition */}
      <button
        onClick={scrollToBottom}
        className={`absolute bottom-12 right-6 p-3 bg-blue-500 text-white rounded-full shadow-lg transition-all duration-300 ease-in-out ${
          showScrollButton ? 'opacity-100 translate-y-0 cursor-pointer pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Scroll to bottom"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

export default MessageList;
