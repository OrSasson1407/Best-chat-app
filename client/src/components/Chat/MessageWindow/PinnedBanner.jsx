import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaThumbtack } from "react-icons/fa";
import { PinnedBanner as StyledPinnedBanner } from "./MessageWindow.styles";

export default function PinnedBanner({ pinnedMessage, scrollToMessage }) {
  return (
    <AnimatePresence>
      {pinnedMessage && (
        <StyledPinnedBanner
          as={motion.div}
          onClick={() => scrollToMessage(pinnedMessage.id)}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <FaThumbtack />
          <div className="pin-content">
            <span className="pin-title">Pinned Message</span>
            <span className="pin-text">{pinnedMessage.message.substring(0, 80)}...</span>
          </div>
        </StyledPinnedBanner>
      )}
    </AnimatePresence>
  );
}
