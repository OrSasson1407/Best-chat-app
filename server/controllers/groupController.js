const Groups = require("../models/GroupModel");
const Messages = require("../models/Message");

module.exports.createGroup = async (req, res, next) => {
  try {
    const { name, members, admin } = req.body;
    const group = await Groups.create({
      name,
      members, // Array of User IDs
      admin,
    });
    return res.json({ status: true, group });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getUserGroups = async (req, res, next) => {
  try {
    const userId = req.params.id;
    // Find groups where the user is listed in 'members'
    const groups = await Groups.find({ members: { $in: [userId] } });
    return res.json(groups);
  } catch (ex) {
    next(ex);
  }
};

module.exports.getGroupMessages = async (req, res, next) => {
  try {
    const { from, groupId } = req.body;
    // Fetch messages linked to this Group ID
    const messages = await Messages.find({ users: { $in: [groupId] } })
      .populate("sender", "username") // Get sender name for group chat context
      .populate("replyTo", "message.text sender type") // Bring in replied message details
      .sort({ updatedAt: 1 });

    const projectedMessages = messages.map((msg) => {
      return {
        id: msg._id, // Needed for reacting, replying, and read receipts
        fromSelf: msg.sender._id.toString() === from,
        username: msg.sender.username, // Needed to show who sent what in the group
        message: msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt,
        status: msg.status, // WhatsApp-style status tracking
        reactions: msg.reactions || [],
        replyTo: msg.replyTo ? {
            text: msg.replyTo.message.text,
            type: msg.replyTo.type,
            isSelfQuote: msg.replyTo.sender.toString() === from
        } : null,
      };
    });
    res.json(projectedMessages);
  } catch (ex) {
    next(ex);
  }
};

// Admin Feature: Add User
module.exports.addMember = async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;
        // In a full production app, you might want to verify req.user === group.admin here
        const group = await Groups.findByIdAndUpdate(
            groupId, 
            { $addToSet: { members: userId } }, // Add only if not exists
            { new: true }
        );
        return res.json({ status: true, group });
    } catch (ex) {
        next(ex);
    }
};

// Admin Feature: Remove User
module.exports.removeMember = async (req, res, next) => {
    try {
        const { groupId, userId } = req.body;
        // Verify admin permissions here if necessary
        const group = await Groups.findByIdAndUpdate(
            groupId, 
            { $pull: { members: userId } },
            { new: true }
        );
        return res.json({ status: true, group });
    } catch (ex) {
        next(ex);
    }
};

// Admin Feature: Delete Group
module.exports.deleteGroup = async (req, res, next) => {
    try {
       // Verify admin permissions here if necessary
       await Groups.findByIdAndDelete(req.params.id);
       return res.json({ status: true, msg: "Group deleted" });
    } catch (ex) {
        next(ex);
    }
};