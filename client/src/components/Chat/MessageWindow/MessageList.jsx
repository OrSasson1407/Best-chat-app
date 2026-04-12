import React, { useRef, useState, useCallback, useEffect, memo } from "react";
import { Virtuoso } from "react-virtuoso";
import { AnimatePresence, motion } from "framer-motion";
import { FaSpinner, FaArrowDown } from "react-icons/fa";
import MessageItem from "./MessageItem";
import { MessagesArea, ScrollButton } from "./MessageWindow.styles";

// ✅ ADDED: Pull UI states globally using shallow equality
import useChatStore from "../../../store/chatStore";
import { useShallow } from "zustand/react/shallow";

// ✅ CRITICAL FIX: Wrap the single message item in React.memo to prevent 
// deep re-renders across the entire list when unrelated state updates.
const MemoizedMessageItem = memo(MessageItem);

export default function MessageList({
  filteredMessages = [], 
  isFetchingHistory,
  isLoadingMore,
  isTyping,
  isGroupChat,
  currentChat,
  currentUser,
  highlightedMsgId,
  hasMore,
  loadMoreMessages,
  setLightboxImage,
  setReadReceiptsMsg,
  scrollToMessage,
  setReplyingTo,
  setEditingMessage,
  handleDeleteMsg,
  handleReaction,
  handleOpenViewOnce,
  handleRetryMsg,
}) {
  const virtuosoRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadScrollCount, setUnreadScrollCount] = useState(0);

  // ✅ FIX: Use useShallow so the list component only re-renders when THESE values change
  const { theme, isCompact, searchQuery } = useChatStore(useShallow(state => ({
    theme: state.theme,
    isCompact: state.isCompact,
    searchQuery: state.searchQuery
  })));

  const skeletonWidths = ["45%", "65%", "35%", "80%", "50%"];

  useEffect(() => {
    isScrolledUpRef.current = showScrollBtn;
  }, [showScrollBtn]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: filteredMessages.length - 1,
      behavior: "smooth",
    });
    setUnreadScrollCount(0);
  }, [filteredMessages.length]);

  // Expose scroll trigger to parent via ref if needed
  useEffect(() => {
    if (!isScrolledUpRef.current) {
      setUnreadScrollCount(0);
    }
  }, [filteredMessages.length]);

  // ✅ FIX: Extract the Virtuoso item content render function using useCallback
  // This prevents the entire Virtual DOM tree from recreating functions on every tick
  const itemRenderer = useCallback((index, message) => {
    return (
      <MemoizedMessageItem
        message={message}
        prevMsg={index > 0 ? filteredMessages[index - 1] : null}
        nextMsg={index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null}
        currentChat={currentChat}
        currentUser={currentUser}
        searchQuery={searchQuery}
        highlightedMsgId={highlightedMsgId}
        setLightboxImage={setLightboxImage}
        setReadReceiptsMsg={setReadReceiptsMsg}
        scrollToMessage={scrollToMessage}
        setReplyingTo={setReplyingTo}
        setEditingMessage={setEditingMessage}
        handleDeleteMsg={handleDeleteMsg}
        handleReaction={handleReaction}
        handleOpenViewOnce={handleOpenViewOnce}
        handleRetryMsg={handleRetryMsg}
      />
    );
  }, [
    filteredMessages, currentChat, currentUser, searchQuery, highlightedMsgId,
    setLightboxImage, setReadReceiptsMsg, scrollToMessage, setReplyingTo,
    setEditingMessage, handleDeleteMsg, handleReaction, handleOpenViewOnce, handleRetryMsg
  ]);

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <MessagesArea $themeType={theme} $isCompact={isCompact}>
        {isFetchingHistory ? (
          <div className="skeleton-container">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`message skeleton-msg ${i % 2 === 0 ? "sended" : "recieved"}`}>
                <div
                  className="content skeleton-anim"
                  style={{ width: skeletonWidths[i], height: "45px" }}
                />
              </div>
            ))}
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            className="virtuoso-scroll"
            data={filteredMessages}
            firstItemIndex={0}
            initialTopMostItemIndex={filteredMessages.length - 1}
            startReached={() => hasMore && loadMoreMessages?.()} 
            atBottomStateChange={(bottom) => {
              setShowScrollBtn(!bottom);
              if (bottom) setUnreadScrollCount(0);
            }}
            followOutput={(isAtBottom) => (isAtBottom ? "smooth" : false)}
            components={{
              Header: () =>
                isLoadingMore ? (
                  <div className="loading-older">
                    <FaSpinner className="fa-spin" /> Loading older messages...
                  </div>
                ) : null,
              Footer: () =>
                isTyping ? (
                  <div className="message-wrapper" style={{ paddingBottom: "10px" }}>
                    <div className="message recieved typing-msg">
                      <div
                        className="content tail-physics"
                        style={{ minWidth: "60px", padding: "0.8rem 1.2rem" }}
                      >
                        {typeof isTyping === "string" && isGroupChat && (
                          <span className="sender-name" style={{ marginBottom: "2px" }}>
                            {isTyping}
                          </span>
                        )}
                        <div className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: "20px" }} />
                ),
            }}
            // ✅ FIX: Use the stable callback instead of an inline arrow function
            itemContent={itemRenderer}
          />
        )}
      </MessagesArea>

      <AnimatePresence>
        {showScrollBtn && (
          <ScrollButton
            as={motion.button}
            onClick={scrollToBottom}
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <FaArrowDown />
            {unreadScrollCount > 0 && (
              <span className="unread-badge">
                {unreadScrollCount > 99 ? "99+" : unreadScrollCount}
              </span>
            )}
          </ScrollButton>
        )}
      </AnimatePresence>
    </div>
  );
}