import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaTimes, FaGlobe, FaSpinner } from "react-icons/fa";
import { ModalOverlay } from "./Modals.styles";
import { formatTime } from "../../Sidebar/ContactList/chatHelpers";

export default function GlobalSearchModal({
  show,
  adaptiveAccent,
  isGlobalSearching,
  globalSearchResults,
  onClose,
  onSearch,
}) {
  return (
    <AnimatePresence>
      {show && (
        <ModalOverlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-card"
            style={{ width: "600px", maxWidth: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-btn-small" onClick={onClose}>
              <FaTimes />
            </button>
            <h3>
              <FaGlobe color={adaptiveAccent} style={{ marginRight: "8px" }} />
              Global Search
            </h3>

            <input
              id="globalSearchInput"
              name="globalSearchInput"
              autoFocus
              type="text"
              placeholder="Search all your chats..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--glass-border)",
                background: "var(--input-bg)",
                color: "var(--text-main)",
                marginBottom: "15px",
                fontSize: "1rem",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch(e.target.value);
              }}
            />

            <div
              style={{
                maxHeight: "400px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {isGlobalSearching ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--text-dim)",
                  }}
                >
                  <FaSpinner className="fa-spin" size={24} /> <br />
                  Searching everywhere...
                </div>
              ) : globalSearchResults.length > 0 ? (
                globalSearchResults.map((res, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px",
                      background: "var(--input-bg)",
                      borderRadius: "8px",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-dim)",
                        marginBottom: "4px",
                      }}
                    >
                      {formatTime(res.createdAt)}
                    </div>
                    <div style={{ color: "var(--text-main)", fontSize: "0.95rem" }}>
                      {res.text || res.message?.text}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-dim)",
                    fontStyle: "italic",
                  }}
                >
                  Press Enter to search across all chats.
                </div>
              )}
            </div>
          </motion.div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
