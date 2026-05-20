import React, { useState, Suspense } from 'react';
import useChatStore from '../../../store/chatStore'; // ?? Fixed the import path!

// ?? High Impact: Lazy load the 700KB emoji picker. 
// It will ONLY be fetched from the network when the user clicks the emoji button.
const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

const ChatInput = ({ activeGroupId }) => {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  
  // Use the Optimistic UI function we built previously
  const { sendMessageOptimistic } = useChatStore();
  
  // Note: In your actual app, grab the real senderId from your Auth context/store
  const senderId = "current-user-id"; 

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim() || !activeGroupId) return;

    // Trigger instant optimistic UI render
    sendMessageOptimistic(activeGroupId, message, senderId);
    setMessage('');
    setShowEmoji(false);
  };

  const onEmojiClick = (emojiObject) => {
    setMessage(prev => prev + emojiObject.emoji);
  };

  return (
    <div className="chat-input-container w-full p-4 bg-white border-t flex flex-col">
      {showEmoji && (
        <div className="absolute bottom-20 left-4 z-50 shadow-lg rounded-lg">
          {/* Suspense boundary shows a fallback while the emoji chunk downloads */}
          <Suspense fallback={<div className="p-4 bg-gray-100 rounded">Loading emojis...</div>}>
            <EmojiPicker onEmojiClick={onEmojiClick} theme="auto" />
          </Suspense>
        </div>
      )}
      
      <form onSubmit={handleSend} className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
          aria-label="Toggle emoji picker"
        >
          ??
        </button>
        
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <button 
          type="submit" 
          className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition-colors"
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
