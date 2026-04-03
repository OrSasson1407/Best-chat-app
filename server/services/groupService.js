const Group = require("../models/GroupModel");
const Message = require("../models/Message");
const { v4: uuidv4 } = require("uuid"); 

class GroupService {
  
  // Custom error thrower to keep HTTP status codes intact
  throwError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  }

  async createGroup(data, currentUserId) {
    const { name, members, description, avatarImage, groupKeys } = data;
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

    return group;
  }

  async getUserGroups(userId) {
    return await Group.find({ members: { $in: [userId] } });
  }

  async getGroupMessages({ from, groupId, cursor, limit = 50 }) {
    let query = { 
        users: { $all: [groupId] },
        deletedFor: { $ne: from }
    };

    // FIX: cursor is a MongoDB _id string (same as DM service), not a date string
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const messages = await Message.find(query)
      .sort({ _id: -1 }) // FIX: sort by _id to match cursor-based pagination
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

    return {
        messages: projectedMessages,
        hasMore: messages.length === limit, 
        nextCursor: messages.length > 0 ? messages[0]._id : null // FIX: return _id as cursor
    };
  }

  async addMember({ groupId, userId, encryptedKey }, currentUserId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");

    if (!group.admins.includes(currentUserId) && !group.moderators.includes(currentUserId)) {
        this.throwError(403, "Only admins and moderators can add members.");
    }

    if (group.bannedUsers.includes(userId)) {
         this.throwError(403, "This user is banned from the group.");
    }

    if (!group.members.includes(userId)) {
        group.members.push(userId);
        if (encryptedKey) {
            group.groupKeys.push({ userId, encryptedKey });
        }
        await group.save();
    }
    return group;
  }

  async removeMember({ groupId, userId }, currentUserId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");

    const isModTryingToRemoveAdminOrMod = group.moderators.includes(currentUserId) && (group.admins.includes(userId) || group.moderators.includes(userId));

    if (!group.admins.includes(currentUserId) && !group.moderators.includes(currentUserId)) {
        this.throwError(403, "You do not have permission to remove members.");
    }

    if (isModTryingToRemoveAdminOrMod) {
         this.throwError(403, "Moderators cannot remove admins or other moderators.");
    }

    if (group.admins.includes(userId) && group.admins.length === 1) {
         this.throwError(400, "Cannot remove the only admin. Promote someone else first.");
    }

    group.members.pull(userId);
    group.admins.pull(userId); 
    group.moderators.pull(userId); 
    group.groupKeys = group.groupKeys.filter(k => k.userId.toString() !== userId);

    await group.save();
    return group;
  }

  async leaveGroup(groupId, currentUserId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");

    if (group.admins.includes(currentUserId) && group.admins.length === 1 && group.members.length > 1) {
        this.throwError(400, "You are the only admin. Promote someone else before leaving.");
    }

    group.members.pull(currentUserId);
    group.admins.pull(currentUserId);
    group.moderators.pull(currentUserId); 
    group.groupKeys = group.groupKeys.filter(k => k.userId.toString() !== currentUserId);

    if (group.members.length === 0) {
        await Group.findByIdAndDelete(groupId);
        return { deleted: true, msg: "Group deleted because it was empty." };
    }

    await group.save();
    return { deleted: false, msg: "Successfully left the group." };
  }

  async deleteGroup(groupId, currentUserId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");

    if (!group.admins.includes(currentUserId)) {
        this.throwError(403, "Only admins can delete the group.");
    }

    await Group.findByIdAndDelete(groupId);
    await Message.deleteMany({ users: { $in: [groupId] } });
  }

  async promoteToModerator({ groupId, targetUserId }, adminId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");

    if (!group.admins.includes(adminId)) {
      this.throwError(403, "Only admins can promote members.");
    }

    if (!group.moderators.includes(targetUserId)) {
      group.moderators.push(targetUserId);
      await group.save();
    }
    return group.moderators;
  }

  async demoteModerator({ groupId, targetUserId }, adminId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");

    if (!group.admins.includes(adminId)) {
      this.throwError(403, "Only admins can demote members.");
    }

    group.moderators.pull(targetUserId);
    await group.save();
    return group.moderators;
  }

  async promoteToAdmin({ groupId, targetUserId }, adminId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");

    if (!group.admins.includes(adminId)) {
      this.throwError(403, "Only current admins can promote to admin.");
    }

    if (!group.admins.includes(targetUserId)) {
      group.admins.push(targetUserId);
      group.moderators.pull(targetUserId); 
      await group.save();
    }
    return group.admins;
  }

  async kickMember({ groupId, userId }, currentUserId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");

    const isAdmin = group.admins.includes(currentUserId);
    const isMod = group.moderators.includes(currentUserId);

    if (!isAdmin && !isMod) {
        this.throwError(403, "You do not have permission to kick members.");
    }

    if (isMod && (group.admins.includes(userId) || group.moderators.includes(userId))) {
         this.throwError(403, "Moderators cannot kick admins or other moderators.");
    }

    group.members.pull(userId);
    group.admins.pull(userId); 
    group.moderators.pull(userId); 
    group.groupKeys = group.groupKeys.filter(k => k.userId.toString() !== userId);
    
    if (!group.bannedUsers.includes(userId)) {
        group.bannedUsers.push(userId);
    }

    await group.save();
  }

  async createChannel(data, currentUserId) {
    const { name, description, avatarImage } = data;
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
    return channel;
  }

  async searchPublicChannels(query) {
    if (!query) return [];
    return await Group.find({ 
      isPublic: true, 
      name: { $regex: query, $options: "i" } 
    }).select("name description avatarImage members isChannel");
  }

  async joinChannel({ channelId }, userId) {
    const channel = await Group.findById(channelId);
    if (!channel || !channel.isPublic) {
      this.throwError(404, "Public channel not found");
    }

    if (channel.bannedUsers.includes(userId)) {
      this.throwError(403, "You have been banned from this channel.");
    }

    if (channel.members.includes(userId)) {
      this.throwError(400, "Already a member");
    }

    channel.members.push(userId);
    await channel.save();
    return channel;
  }
}

module.exports = new GroupService();