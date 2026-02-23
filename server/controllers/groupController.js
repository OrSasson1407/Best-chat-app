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
      .populate("sender", "username") // Get sender name
      .sort({ updatedAt: 1 });

    const projectedMessages = messages.map((msg) => {
      return {
        fromSelf: msg.sender._id.toString() === from,
        username: msg.sender.username, // Needed for group chat
        message: msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt,
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
       await Groups.findByIdAndDelete(req.params.id);
       return res.json({ status: true, msg: "Group deleted" });
    } catch (ex) {
        next(ex);
    }
};