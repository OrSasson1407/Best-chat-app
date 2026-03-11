const Group = require("../models/GroupModel");
const Message = require("../models/Message");
const { v4: uuidv4 } = require("uuid"); 

module.exports.createGroup = async (req, res, next) => {
  try {
    const { name, members, description, avatarImage, groupKeys } = req.body;
    const currentUserId = req.user.id; 

    const finalMembers = members.includes(currentUserId) ? members : [...members, currentUserId];

    const group = await Group.create({
      name,
      description: description || "",
      avatarImage: avatarImage || "",
      members: finalMembers,
      admins: [currentUserId], 
      groupKeys: groupKeys || [], 
      inviteCode: uuidv4().substring(0, 8), 
    });

    return res.json({ status: true, group });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getUserGroups = async (req, res, next) => {
  try {
    const userId = req.user.id; 
    const groups = await Group.find({ members: { $in: [userId] } });
    return res.json(groups); 
  } catch (ex) {
    next(ex);
  }
};

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
        username: msg.sender.username, 
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

// --- CORE MEMBER MANAGEMENT ---

module.exports.addMember = async (req, res, next) => {
    try {
        const { groupId, userId, encryptedKey } = req.body;
        const currentUserId = req.user.id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ msg: "Group not found" });

        if (!group.admins.includes(currentUserId) && !group.moderators.includes(currentUserId)) {
            return res.status(403).json({ msg: "Only admins and moderators can add members." });
        }

        if (group.bannedUsers.includes(userId)) {
             return res.status(403).json({ msg: "This user is banned from the group." });
        }

        if (!group.members.includes(userId)) {
            group.members.push(userId);
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

module.exports.removeMember = async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;
        const currentUserId = req.user.id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ msg: "Group not found" });

        // Admins can remove anyone. Mods can only remove regular members.
        const isModTryingToRemoveAdminOrMod = group.moderators.includes(currentUserId) && (group.admins.includes(userId) || group.moderators.includes(userId));

        if (!group.admins.includes(currentUserId) && !group.moderators.includes(currentUserId)) {
            return res.status(403).json({ msg: "You do not have permission to remove members." });
        }

        if (isModTryingToRemoveAdminOrMod) {
             return res.status(403).json({ msg: "Moderators cannot remove admins or other moderators." });
        }

        if (group.admins.includes(userId) && group.admins.length === 1) {
             return res.status(400).json({ msg: "Cannot remove the only admin. Promote someone else first." });
        }

        group.members.pull(userId);
        group.admins.pull(userId); 
        group.moderators.pull(userId); 
        
        group.groupKeys = group.groupKeys.filter(k => k.userId.toString() !== userId);

        await group.save();

        return res.json({ status: true, group });
    } catch (ex) {
        next(ex);
    }
};

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
        group.moderators.pull(currentUserId); 
        
        group.groupKeys = group.groupKeys.filter(k => k.userId.toString() !== currentUserId);

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
       await Message.deleteMany({ users: { $in: [groupId] } });

       return res.json({ status: true, msg: "Group deleted successfully" });
    } catch (ex) {
        next(ex);
    }
};

// --- ADVANCED ROLE MANAGEMENT & MODERATION ---

module.exports.promoteToModerator = async (req, res, next) => {
  try {
    const { groupId, targetUserId } = req.body;
    const adminId = req.user.id;
    
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ status: false, msg: "Group not found" });

    if (!group.admins.includes(adminId)) {
      return res.status(403).json({ status: false, msg: "Only admins can promote members." });
    }

    if (!group.moderators.includes(targetUserId)) {
      group.moderators.push(targetUserId);
      await group.save();
    }

    return res.status(200).json({ status: true, moderators: group.moderators });
  } catch (ex) {
    next(ex);
  }
};

module.exports.demoteModerator = async (req, res, next) => {
  try {
    const { groupId, targetUserId } = req.body;
    const adminId = req.user.id;
    
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ status: false, msg: "Group not found" });

    if (!group.admins.includes(adminId)) {
      return res.status(403).json({ status: false, msg: "Only admins can demote members." });
    }

    group.moderators.pull(targetUserId);
    await group.save();

    return res.status(200).json({ status: true, moderators: group.moderators });
  } catch (ex) {
    next(ex);
  }
};

module.exports.promoteToAdmin = async (req, res, next) => {
  try {
    const { groupId, targetUserId } = req.body;
    const adminId = req.user.id;
    
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ status: false, msg: "Group not found" });

    if (!group.admins.includes(adminId)) {
      return res.status(403).json({ status: false, msg: "Only current admins can promote to admin." });
    }

    if (!group.admins.includes(targetUserId)) {
      group.admins.push(targetUserId);
      // Optional: Remove them from moderators if they are becoming an admin
      group.moderators.pull(targetUserId); 
      await group.save();
    }

    return res.status(200).json({ status: true, admins: group.admins });
  } catch (ex) {
    next(ex);
  }
};

module.exports.kickMember = async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;
        const currentUserId = req.user.id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ msg: "Group not found" });

        const isAdmin = group.admins.includes(currentUserId);
        const isMod = group.moderators.includes(currentUserId);

        if (!isAdmin && !isMod) {
            return res.status(403).json({ msg: "You do not have permission to kick members." });
        }

        if (isMod && (group.admins.includes(userId) || group.moderators.includes(userId))) {
             return res.status(403).json({ msg: "Moderators cannot kick admins or other moderators." });
        }

        group.members.pull(userId);
        group.admins.pull(userId); 
        group.moderators.pull(userId); 
        group.groupKeys = group.groupKeys.filter(k => k.userId.toString() !== userId);
        
        // Add to banned list to prevent immediate re-entry via invite link
        if (!group.bannedUsers.includes(userId)) {
            group.bannedUsers.push(userId);
        }

        await group.save();

        return res.json({ status: true, msg: "User kicked and banned from joining." });
    } catch (ex) {
        next(ex);
    }
};

// --- PUBLIC CHANNELS ---

module.exports.createChannel = async (req, res, next) => {
  try {
    const { name, description, avatarImage } = req.body;
    const currentUserId = req.user.id;
    
    const channel = await Group.create({
      name,
      description: description || "",
      avatarImage: avatarImage || "",
      members: [currentUserId],
      admins: [currentUserId],
      isChannel: true,
      isPublic: true,
      inviteCode: uuidv4().substring(0, 8),
    });

    return res.status(201).json({ status: true, channel });
  } catch (ex) {
    next(ex);
  }
};

module.exports.searchPublicChannels = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query) return res.json({ status: true, channels: [] });

    const channels = await Group.find({ 
      isPublic: true, 
      name: { $regex: query, $options: "i" } 
    }).select("name description avatarImage members isChannel");

    return res.status(200).json({ status: true, channels });
  } catch (ex) {
    next(ex);
  }
};

module.exports.joinChannel = async (req, res, next) => {
  try {
    const { channelId } = req.body;
    const userId = req.user.id;
    
    const channel = await Group.findById(channelId);
    if (!channel || !channel.isPublic) {
      return res.status(404).json({ status: false, msg: "Public channel not found" });
    }

    if (channel.bannedUsers.includes(userId)) {
      return res.status(403).json({ status: false, msg: "You have been banned from this channel." });
    }

    if (channel.members.includes(userId)) {
      return res.status(400).json({ status: false, msg: "Already a member" });
    }

    channel.members.push(userId);
    await channel.save();

    return res.status(200).json({ status: true, channel });
  } catch (ex) {
    next(ex);
  }
};