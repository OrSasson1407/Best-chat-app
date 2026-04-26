const Group = require("../models/GroupModel");
const Message = require("../models/Message");
const { v4: uuidv4 } = require("uuid");

class GroupService {

  throwError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  }

  async createGroup(data, currentUserId) {
    const { name, members, description, avatarImage, groupKeys, maxMembers } = data;
    const finalMembers = members.includes(currentUserId) ? members : [...members, currentUserId];

    // Sprint 3: enforce maxMembers at creation
    if (maxMembers && maxMembers > 0 && finalMembers.length > maxMembers) {
      this.throwError(400, `Group cannot exceed ${maxMembers} members.`);
    }

    const group = await Group.create({
      name,
      description: description || "",
      avatarImage: avatarImage || "",
      members: finalMembers,
      admins: [currentUserId],
      groupKeys: groupKeys || [],
      inviteCode: uuidv4().substring(0, 8),
      maxMembers: maxMembers || 0,       // Sprint 3
      inviteLinkEnabled: true,           // Sprint 3
    });

    return group;
  }

  async getUserGroups(userId) {
    return await Group.find({ members: { $in: [userId] } });
  }

  async getGroupMessages({ from, groupId, cursor, limit = 50 }) {
    let query = {
      users: { $all: [groupId] },
      deletedFor: { $ne: from },
    };

    if (cursor) query._id = { $lt: cursor };

    const messages = await Message.find(query)
      .sort({ _id: -1 })
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
        replyTo: msg.replyTo
          ? {
              id: msg.replyTo._id,
              text: msg.replyTo.isDeleted ? "🚫 This message was deleted" : msg.replyTo.message.text,
              type: msg.replyTo.type,
              // BUG-014 FIX: Handle populated object vs ObjectId string safely to determine isSelfQuote
              isSelfQuote: msg.replyTo.sender && msg.replyTo.sender._id 
                             ? msg.replyTo.sender._id.toString() === from 
                             : msg.replyTo.sender?.toString() === from,
            }
          : null,
      };
    });

    return {
      messages: projectedMessages,
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[0]._id : null,
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

    // Sprint 3: enforce maxMembers cap
    if (group.maxMembers > 0 && group.members.length >= group.maxMembers) {
      this.throwError(400, `This group has reached its maximum of ${group.maxMembers} members.`);
    }

    if (!group.members.includes(userId)) {
      group.members.push(userId);
      if (encryptedKey) group.groupKeys.push({ userId, encryptedKey });
      await group.save();
    }
    return group;
  }

  async removeMember({ groupId, userId }, currentUserId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");

    const isModTryingToRemoveAdminOrMod =
      group.moderators.includes(currentUserId) &&
      (group.admins.includes(userId) || group.moderators.includes(userId));

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
    group.groupKeys = group.groupKeys.filter((k) => k.userId.toString() !== userId);
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
    group.groupKeys = group.groupKeys.filter((k) => k.userId.toString() !== currentUserId);

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
    if (!group.admins.includes(currentUserId)) this.throwError(403, "Only admins can delete the group.");
    await Group.findByIdAndDelete(groupId);
    await Message.deleteMany({ users: { $in: [groupId] } });
  }

  async promoteToModerator({ groupId, targetUserId }, adminId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");
    if (!group.admins.includes(adminId)) this.throwError(403, "Only admins can promote members.");
    if (!group.moderators.includes(targetUserId)) { group.moderators.push(targetUserId); await group.save(); }
    return group.moderators;
  }

  async demoteModerator({ groupId, targetUserId }, adminId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");
    if (!group.admins.includes(adminId)) this.throwError(403, "Only admins can demote members.");
    group.moderators.pull(targetUserId);
    await group.save();
    return group.moderators;
  }

  async promoteToAdmin({ groupId, targetUserId }, adminId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");
    if (!group.admins.includes(adminId)) this.throwError(403, "Only current admins can promote to admin.");
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
    const isMod   = group.moderators.includes(currentUserId);

    if (!isAdmin && !isMod) this.throwError(403, "You do not have permission to kick members.");
    if (isMod && (group.admins.includes(userId) || group.moderators.includes(userId))) {
      this.throwError(403, "Moderators cannot kick admins or other moderators.");
    }

    group.members.pull(userId);
    group.admins.pull(userId);
    group.moderators.pull(userId);
    group.groupKeys = group.groupKeys.filter((k) => k.userId.toString() !== userId);
    if (!group.bannedUsers.includes(userId)) group.bannedUsers.push(userId);
    await group.save();
  }

  async createChannel(data, currentUserId) {
    const { name, description, avatarImage } = data;
    return await Group.create({
      name,
      description: description || "",
      avatarImage: avatarImage || "",
      members: [currentUserId],
      admins: [currentUserId],
      isChannel: true,
      isPublic: true,
      inviteCode: uuidv4().substring(0, 8),
      inviteLinkEnabled: true,
    });
  }

  async searchPublicChannels(query) {
    if (!query) return [];
    return await Group.find({ isPublic: true, name: { $regex: query, $options: "i" } }).select(
      "name description avatarImage members isChannel"
    );
  }

  async joinChannel({ channelId }, userId) {
    const channel = await Group.findById(channelId);
    if (!channel || !channel.isPublic) this.throwError(404, "Public channel not found");
    if (channel.bannedUsers.includes(userId)) this.throwError(403, "You have been banned from this channel.");
    if (channel.members.includes(userId)) this.throwError(400, "Already a member");

    // Sprint 3: enforce maxMembers on channel join too
    if (channel.maxMembers > 0 && channel.members.length >= channel.maxMembers) {
      this.throwError(400, `This channel has reached its maximum of ${channel.maxMembers} members.`);
    }

    channel.members.push(userId);
    await channel.save();
    return channel;
  }

  // ==========================================================================
  // SPRINT 3 — GROUP RULES
  // ==========================================================================

  async setGroupRules({ groupId, rules }, adminId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");
    if (!group.admins.includes(adminId) && !group.moderators.includes(adminId)) {
      this.throwError(403, "Only admins and moderators can set group rules.");
    }
    group.rules = rules || "";
    await group.save();
    return group.rules;
  }

  // ==========================================================================
  // SPRINT 3 — MAX MEMBER LIMIT
  // ==========================================================================

  async setMaxMembers({ groupId, maxMembers }, adminId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");
    if (!group.admins.includes(adminId)) this.throwError(403, "Only admins can set member limits.");
    if (maxMembers < 0) this.throwError(400, "maxMembers cannot be negative.");
    group.maxMembers = maxMembers;
    await group.save();
    return group.maxMembers;
  }

  // ==========================================================================
  // SPRINT 3 — QR / INVITE LINK
  // ==========================================================================

  // Return (or regenerate) the invite code for a group
  async getInviteCode(groupId, requesterId) {
    const group = await Group.findById(groupId);
    if (!group) this.throwError(404, "Group not found");
    if (!group.members.map(String).includes(String(requesterId))) {
      this.throwError(403, "Only group members can view the invite link.");
    }
    if (!group.inviteCode) {
      group.inviteCode = uuidv4().substring(0, 8);
      await group.save();
    }
    return { inviteCode: group.inviteCode, inviteLinkEnabled: group.inviteLinkEnabled };
  }

  // BUG-015 FIX: Modified to capture encryptedKey payload and assign it
  async joinViaInviteCode({ code, encryptedKey }, userId) {
    const group = await Group.findOne({ inviteCode: code });
    if (!group) this.throwError(404, "Invalid or expired invite code.");
    if (!group.inviteLinkEnabled) this.throwError(403, "Invite link has been disabled.");
    if (group.bannedUsers.map(String).includes(String(userId))) this.throwError(403, "You are banned from this group.");
    if (group.members.map(String).includes(String(userId))) this.throwError(400, "You are already a member.");
    if (group.maxMembers > 0 && group.members.length >= group.maxMembers) {
      this.throwError(400, `This group is full (max ${group.maxMembers} members).`);
    }
    
    group.members.push(userId);
    
    // BUG-015 FIX: Ensure new members store their E2E encrypted group payload when rejoining via link code.
    if (encryptedKey) {
      group.groupKeys.push({ userId, encryptedKey });
    }

    await group.save();
    return group;
  }
}

module.exports = new GroupService();