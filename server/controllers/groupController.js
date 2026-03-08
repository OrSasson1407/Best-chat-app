const Group = require("../models/GroupModel");
const Message = require("../models/Message");
const { v4: uuidv4 } = require("uuid"); // For generating invite links

module.exports.createGroup = async (req, res, next) => {
  try {
    // --- MERGE UPDATE: Destructure groupKeys from the request ---
    const { name, members, description, avatarImage, groupKeys } = req.body;
    const currentUserId = req.user.id; // Securely pulled from authMiddleware

    // Ensure the creator is in the members list
    const finalMembers = members.includes(currentUserId) ? members : [...members, currentUserId];

    const group = await Group.create({
      name,
      description: description || "",
      avatarImage: avatarImage || "",
      members: finalMembers,
      admins: [currentUserId], // Creator is the first admin
      groupKeys: groupKeys || [], // --- MERGE UPDATE: Save the encrypted keys to DB
      inviteCode: uuidv4().substring(0, 8), // Short invite code
    });

    return res.json({ status: true, group });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getUserGroups = async (req, res, next) => {
  try {
    const userId = req.user.id; // Securely pulled from authMiddleware
    const groups = await Group.find({ members: { $in: [userId] } });
    return res.json(groups); // Automatically returns the groupKeys array attached to the group docs
  } catch (ex) {
    next(ex);
  }
};

// --- MERGE UPDATE: Brought Group Messages up to parity with main Chat ---
module.exports.getGroupMessages = async (req, res, next) => {
  try {
    const { from, groupId, cursor, limit = 50 } = req.body;

    let query = { 
        users: { $all: [groupId] },
        deletedFor: { $ne: from }
    };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) }; 
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "username") 
      .populate("replyTo", "message.text sender type isDeleted");

    messages.reverse();

    const projectedMessages = messages.map((msg) => {
      const hasViewed = msg.viewed || (msg.viewedBy && msg.viewedBy.includes(from));
      const isHiddenViewOnce = msg.isViewOnce && hasViewed && msg.sender._id.toString() !== from;

      return {
        id: msg._id,
        fromSelf: msg.sender._id.toString() === from,
        username: msg.sender.username, // Needed for group chat UI
        message: msg.isDeleted ? "🚫 This message was deleted" : isHiddenViewOnce ? "💣 Media Expired" : msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt,
        status: msg.status || "sent",
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
        isForwarded: msg.isForwarded,
        isViewOnce: msg.isViewOnce,
        viewed: hasViewed,
        isPinned: msg.isPinned,
        isStarred: msg.starredBy && msg.starredBy.includes(from),
        pollData: msg.pollData,
        linkMetadata: msg.linkMetadata,
        fileMetadata: msg.fileMetadata,
        timer: msg.timer,
        scheduledAt: msg.scheduledAt,
        isSent: msg.isSent,
        readBy: msg.readBy,
        reactions: msg.reactions || [],
        replyTo: msg.replyTo ? {
            id: msg.replyTo._id,
            text: msg.replyTo.isDeleted ? "🚫 This message was deleted" : msg.replyTo.message.text,
            type: msg.replyTo.type,
            isSelfQuote: msg.replyTo.sender.toString() === from
        } : null,
      };
    });

    res.json({
        messages: projectedMessages,
        hasMore: messages.length === limit, 
        nextCursor: messages.length > 0 ? messages[0].createdAt : null 
    });
  } catch (ex) {
    next(ex);
  }
};

// --- MERGE UPDATE: Secure Admin Feature ---
module.exports.addMember = async (req, res, next) => {
    try {
        // --- MERGE UPDATE: Destructure encryptedKey for the new user ---
        const { groupId, userId, encryptedKey } = req.body;
        const currentUserId = req.user.id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ msg: "Group not found" });

        // Verify Admin Privileges
        if (!group.admins.includes(currentUserId)) {
            return res.status(403).json({ msg: "Only admins can add members." });
        }

        if (!group.members.includes(userId)) {
            group.members.push(userId);
            
            // --- MERGE UPDATE: Push the newly encrypted key to the DB ---
            if (encryptedKey) {
                group.groupKeys.push({ userId, encryptedKey });
            }
            
            await group.save();
        }

        return res.json({ status: true, group });
    } catch (ex) {
        next(ex);
    }
};

// --- MERGE UPDATE: Secure Admin Feature ---
module.exports.removeMember = async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;
        const currentUserId = req.user.id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ msg: "Group not found" });

        // Verify Admin Privileges
        if (!group.admins.includes(currentUserId)) {
            return res.status(403).json({ msg: "Only admins can remove members." });
        }

        // Prevent removing the last admin without promoting someone else
        if (group.admins.includes(userId) && group.admins.length === 1) {
             return res.status(400).json({ msg: "Cannot remove the only admin. Promote someone else first." });
        }

        group.members.pull(userId);
        group.admins.pull(userId); // Automatically revoke admin if removed
        
        // --- MERGE UPDATE: Remove their key access ---
        group.groupKeys = group.groupKeys.filter(k => k.userId.toString() !== userId);

        await group.save();

        return res.json({ status: true, group });
    } catch (ex) {
        next(ex);
    }
};

// --- NEW FEATURE: Leave Group ---
module.exports.leaveGroup = async (req, res, next) => {
    try {
        const groupId = req.params.id;
        const currentUserId = req.user.id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ msg: "Group not found" });

        if (group.admins.includes(currentUserId) && group.admins.length === 1 && group.members.length > 1) {
            return res.status(400).json({ msg: "You are the only admin. Promote someone else before leaving." });
        }

        group.members.pull(currentUserId);
        group.admins.pull(currentUserId);
        
        // --- MERGE UPDATE: Remove your own key access ---
        group.groupKeys = group.groupKeys.filter(k => k.userId.toString() !== currentUserId);

        // If the group is completely empty, delete it automatically
        if (group.members.length === 0) {
            await Group.findByIdAndDelete(groupId);
            return res.json({ status: true, msg: "Group deleted because it was empty." });
        }

        await group.save();
        return res.json({ status: true, msg: "Successfully left the group." });
    } catch (ex) {
        next(ex);
    }
};

// --- MERGE UPDATE: Secure Admin Feature ---
module.exports.deleteGroup = async (req, res, next) => {
    try {
       const groupId = req.params.id;
       const currentUserId = req.user.id;

       const group = await Group.findById(groupId);
       if (!group) return res.status(404).json({ msg: "Group not found" });

       if (!group.admins.includes(currentUserId)) {
           return res.status(403).json({ msg: "Only admins can delete the group." });
       }

       await Group.findByIdAndDelete(groupId);
       // Clean up associated messages
       await Message.deleteMany({ users: { $in: [groupId] } });

       return res.json({ status: true, msg: "Group deleted successfully" });
    } catch (ex) {
        next(ex);
    }
};