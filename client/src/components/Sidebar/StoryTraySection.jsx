import React from "react";
import { motion } from "framer-motion";
import { FaSpinner, FaPlus } from "react-icons/fa";
import { StoryTray } from "../Contacts.styles"; 

export default function StoryTraySection({
    currentUser,
    storyFeed,
    isUploadingStory,
    fileInputRef,
    handleStoryUpload,
    openStoryViewer,
    handleStoryPressStart,
    handleStoryPressEnd,
    getAvatarUrl
}) {
    return (
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
    );
}