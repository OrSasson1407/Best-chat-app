import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaTimes, FaMagic } from "react-icons/fa";
import { ModalOverlay } from "./Modals.styles";

export default function SummaryModal({ chatSummary, adaptiveAccent, onClose }) {
  return (
    <AnimatePresence>
      {chatSummary && (
        <ModalOverlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-card"
            style={{ maxWidth: "500px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-btn-small" onClick={onClose}>
              <FaTimes />
            </button>
            <h3>
              <FaMagic color={adaptiveAccent} style={{ marginRight: "8px" }} />
              Chat Summary
            </h3>
            <div
              style={{
                padding: "1rem",
                lineHeight: "1.6",
                color: "var(--text-main)",
                fontSize: "0.95rem",
              }}
            >
              <div style={{ whiteSpace: "pre-wrap" }}>{chatSummary}</div>
            </div>
          </motion.div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
