import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaCloudUploadAlt } from "react-icons/fa";
import { DropOverlay } from "./Overlays.styles";

export default function FileDropOverlay({ isDragging, adaptiveAccent, onDragLeave, onDrop }) {
  return (
    <AnimatePresence>
      {isDragging && (
        <DropOverlay
          as={motion.div}
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          transition={{ duration: 0.2 }}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <motion.div
            className="overlay-content"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
          >
            <FaCloudUploadAlt size={80} color={adaptiveAccent} />
            <h2>Drop files to share</h2>
            <p>Images, Videos, and Documents</p>
          </motion.div>
        </DropOverlay>
      )}
    </AnimatePresence>
  );
}
