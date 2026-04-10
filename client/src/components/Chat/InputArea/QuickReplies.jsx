import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaMagic, FaSpinner } from "react-icons/fa";

export default function QuickReplies({
  quickReplies,
  isGeneratingReplies,
  adaptiveAccent,
  onSend,
  currentChat,
  currentUser,
}) {
  const isChannel = currentChat?.isChannel;
  const isAdmin = currentChat?.admins?.includes(currentUser?._id);
  const isMod = currentChat?.moderators?.includes(currentUser?._id);
  const canPost = !isChannel || isAdmin || isMod;

  if (!canPost) return null;

  return (
    <div style={{ position: "relative", width: "100%", padding: "0 2rem" }}>
      <AnimatePresence mode="wait">
        {isGeneratingReplies ? (
          <motion.div
            key="thinking"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "rgba(255,255,255,0.6)",
              fontSize: "0.85rem",
              fontStyle: "italic",
              marginBottom: "8px",
            }}
          >
            <FaMagic className="fa-spin" color={adaptiveAccent} /> AI is thinking...
          </motion.div>
        ) : quickReplies.length > 0 ? (
          <motion.div
            key="replies"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={{
              visible: { transition: { staggerChildren: 0.1 } },
              hidden: {},
            }}
            style={{
              display: "flex",
              gap: "12px",
              overflowX: "auto",
              marginBottom: "12px",
              paddingBottom: "6px",
            }}
          >
            <FaMagic
              color={adaptiveAccent}
              style={{ marginTop: "10px", flexShrink: 0, fontSize: "1.2rem" }}
              title="AI Suggestions"
            />
            {quickReplies.map((reply, i) => (
              <motion.button
                key={i}
                onClick={() => onSend(reply, "text")}
                variants={{
                  hidden: { opacity: 0, scale: 0.8, y: 10 },
                  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" } },
                }}
                whileHover={{
                  y: -3,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  borderColor: adaptiveAccent,
                }}
                whileTap={{ scale: 0.95 }}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                {reply}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
