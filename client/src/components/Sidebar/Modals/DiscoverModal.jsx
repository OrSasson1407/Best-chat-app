import React from "react";
import { motion } from "framer-motion";
import { FaSearch, FaSpinner } from "react-icons/fa";
import { ModalOverlay } from "../Contacts.styles";

export default function DiscoverModal({
    setShowDiscoverModal,
    channelSearchQuery,
    setChannelSearchQuery,
    isSearchingChannels,
    discoveredChannels,
    handleJoinChannel
}) {
    return (
        <ModalOverlay as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
                <h3>Discover Channels</h3>
                <div className="input-field">
                    <FaSearch className="inner-icon" />
                    <input 
                        type="text" 
                        placeholder="Search public channels..." 
                        value={channelSearchQuery} 
                        onChange={(e) => setChannelSearchQuery(e.target.value)} 
                        autoFocus 
                        style={{ paddingLeft: "40px" }} 
                    />
                </div>
                <div className="member-selection" style={{ minHeight: "200px" }}>
                    {isSearchingChannels ? (
                        <div className="center-loading"><FaSpinner className="fa-spin" /></div>
                    ) : discoveredChannels.length > 0 ? (
                        <div className="scroll-list">
                            {discoveredChannels.map(channel => (
                                <div key={channel._id} className="channel-item">
                                    <div className="info">
                                        <h4>{channel.name}</h4>
                                        <p>{channel.members?.length} subscribers</p>
                                    </div>
                                    <button className="btn-primary small" onClick={() => handleJoinChannel(channel._id)}>Join</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        channelSearchQuery.length > 0 && <p className="empty-text">No channels found.</p>
                    )}
                </div>
                <div className="button-group">
                    <button className="btn-secondary full-width" onClick={() => { setShowDiscoverModal(false); setChannelSearchQuery(""); }}>Close</button>
                </div>
            </motion.div>
        </ModalOverlay>
    );
}