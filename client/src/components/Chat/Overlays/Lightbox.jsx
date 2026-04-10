import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaTimes, FaCheckDouble } from "react-icons/fa";
import { LightboxOverlay } from "./Overlays.styles";
import { getSmallAvatar, formatTime } from "../../Sidebar/ContactList/chatHelpers";

export default function Lightbox({ lightboxImage, onClose }) {
  return (
    <AnimatePresence>
      {lightboxImage && (
        <LightboxOverlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <button className="close-btn">
            <FaTimes />
          </button>
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            src={lightboxImage}
            alt="Fullscreen"
            onClick={(e) => e.stopPropagation()}
          />
        </LightboxOverlay>
      )}
    </AnimatePresence>
  );
}

export function ReadReceiptsModal({ readReceiptsMsg, onClose }) {
  return (
    <AnimatePresence>
      {readReceiptsMsg && (
        <LightboxOverlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="receipt-modal"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-btn-small" onClick={onClose}>
              <FaTimes />
            </button>
            <h3>Message Info</h3>
            <div className="msg-preview">
              {readReceiptsMsg.message?.substring(0, 40)}
              {readReceiptsMsg.message?.length > 40 ? "..." : ""}
            </div>
            <div className="readers-list">
              <h4>
                <FaCheckDouble color="#34B7F1" /> Read by (
                {readReceiptsMsg.readBy?.length || 0})
              </h4>

              {!readReceiptsMsg.readBy || readReceiptsMsg.readBy.length === 0 ? (
                <p
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontStyle: "italic",
                    fontSize: "0.9rem",
                    marginTop: "10px",
                  }}
                >
                  No one has read this yet.
                </p>
              ) : (
                readReceiptsMsg.readBy.map((reader, index) => (
                  <div key={index} className="reader-item">
                    <div className="reader-info">
                      <img
                        src={getSmallAvatar(reader.username)}
                        alt="avatar"
                        className="reader-avatar-img"
                      />
                      <span className="reader-name">{reader.username}</span>
                    </div>
                    <span className="reader-time">{formatTime(reader.readAt)}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </LightboxOverlay>
      )}
    </AnimatePresence>
  );
}
