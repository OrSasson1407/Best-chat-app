import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSpinner, FaPlus } from "react-icons/fa";
import { StoryTray, StoryPreviewTooltip } from "./Stories.styles";

export default function StoryTraySection({
    currentUser,
    storyFeed,
    isUploadingStory,
    fileInputRef,
    storyPreview,
    handleStoryUpload,
    openStoryViewer,
    handleStoryPressStart,
    handleStoryPressEnd,
    getAvatarUrl
}) {
    return (
        <div style={{ position: "relative" }}>
            {/* Tooltip Overlay (Moved from Contacts.jsx) */}
            <AnimatePresence>
                {storyPreview && (
                    <StoryPreviewTooltip
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                    >
                        <img src={storyPreview.stories?.[0]?.mediaUrl || getAvatarUrl(storyPreview.user)} alt="preview" />
                        <div className="info">
                            <h4>{storyPreview.user?.username}</h4>
                            <p>{storyPreview.stories?.length} status update{storyPreview.stories?.length > 1 ? "s" : ""}</p>
                        </div>
                    </StoryPreviewTooltip>
                )}
            </AnimatePresence>

            <StoryTray>
                <motion.div className="story-item my-status" onClick={() => fileInputRef.current?.click()} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <div className="story-ring empty">
                        <img src={getAvatarUrl(currentUser)} alt="my-status" />
                        <div className="add-icon">{isUploadingStory ? <FaSpinner className="fa-spin" /> : <FaPlus />}</div>
                    </div>
                    <p>My Status</p>
                    <input id="story-upload" name="story-upload" type="file" hidden ref={fileInputRef} accept="image/*,video/*" onChange={handleStoryUpload} />
                </motion.div>

                {(storyFeed || []).map((feedItem, index) => {
                    const hasUnread = feedItem.stories?.some(s => !s.viewers?.some(v => v.userId === currentUser._id));
                    return (
                        <motion.div
                            key={index}
                            className="story-item"
                            onClick={() => openStoryViewer(feedItem)}
                            onMouseDown={() => handleStoryPressStart(feedItem)}
                            onMouseUp={handleStoryPressEnd}
                            onMouseLeave={handleStoryPressEnd}
                            onTouchStart={() => handleStoryPressStart(feedItem)}
                            onTouchEnd={handleStoryPressEnd}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <motion.div layoutId={`story-avatar-${feedItem.user?._id}`} className={`story-ring ${hasUnread ? "unread" : "read"}`}>
                                <img src={getAvatarUrl(feedItem.user)} alt="status" />
                            </motion.div>
                            <p>{feedItem.user?.username}</p>
                        </motion.div>
                    );
                })}
            </StoryTray>
        </div>
    );
}