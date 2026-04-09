import React from "react";
import { motion } from "framer-motion";
import { FaSearch, FaCheck } from "react-icons/fa";
import { ModalOverlay } from "../Contacts.styles";
export default function CreateGroupModal({
    setShowGroupModal,
    groupName,
    setGroupName,
    groupSearchTerm,
    setGroupSearchTerm,
    contacts,
    selectedMembers,
    toggleMemberSelection,
    handleCreateGroup,
    isCreatingGroup,
    getAvatarUrl
}) {
    return (
        <ModalOverlay as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
                <h3>Create Secure Group</h3>
                <div className="input-field">
                    <label>Group Name</label>
                    <input 
                        type="text" 
                        placeholder="e.g. Project Alpha" 
                        value={groupName} 
                        onChange={(e) => setGroupName(e.target.value)} 
                        autoFocus 
                    />
                </div>
                <div className="member-selection">
                    <label>Select Members</label>
                    
                    <div className="input-field" style={{ padding: "10px 14px 0 14px", marginBottom: "4px" }}>
                        <FaSearch className="inner-icon" style={{ bottom: "12px", left: "26px", fontSize: "0.8rem" }} />
                        <input 
                            type="text" 
                            placeholder="Search users to add..." 
                            value={groupSearchTerm}
                            onChange={(e) => setGroupSearchTerm(e.target.value)}
                            style={{ paddingLeft: "36px", paddingBottom: "8px", paddingTop: "8px" }}
                        />
                    </div>

                    <div className="scroll-list">
                        {(contacts || [])
                            .filter(c => c.username.toLowerCase().includes(groupSearchTerm.toLowerCase()))
                            .map(c => (
                            <div key={c._id} className={`select-item ${selectedMembers?.includes(c._id) ? "selected" : ""}`} onClick={() => toggleMemberSelection(c._id)}>
                                <img src={getAvatarUrl(c)} alt="" />
                                <span>{c.username}</span>
                                {selectedMembers?.includes(c._id) && <FaCheck className="check" />}
                            </div>
                        ))}
                        
                        {contacts.filter(c => c.username.toLowerCase().includes(groupSearchTerm.toLowerCase())).length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                No users found matching "{groupSearchTerm}"
                            </div>
                        )}
                    </div>
                </div>
                <div className="button-group">
                    <button className="btn-secondary" onClick={() => { setShowGroupModal(false); setGroupSearchTerm(""); }}>Cancel</button>
                    <button className="btn-primary" onClick={handleCreateGroup} disabled={isCreatingGroup} style={{ opacity: isCreatingGroup ? 0.6 : 1, cursor: isCreatingGroup ? "not-allowed" : "pointer" }}>
                        {isCreatingGroup ? "Creating..." : "Create Group"}
                    </button>
                </div>
            </motion.div>
        </ModalOverlay>
    );
}