const groupService = require("../services/groupService");

module.exports.createGroup = async (req, res, next) => {
  try {
    const group = await groupService.createGroup(req.body, req.user.id);
    return res.json({ status: true, group });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getUserGroups = async (req, res, next) => {
  try {
    const groups = await groupService.getUserGroups(req.user.id);
    return res.json(groups); 
  } catch (ex) {
    next(ex);
  }
};

module.exports.getGroupMessages = async (req, res, next) => {
  try {
    const result = await groupService.getGroupMessages(req.body);
    res.json(result);
  } catch (ex) {
    next(ex);
  }
};

// --- CORE MEMBER MANAGEMENT ---

module.exports.addMember = async (req, res, next) => {
    try {
        const group = await groupService.addMember(req.body, req.user.id);
        return res.json({ status: true, group });
    } catch (ex) {
        next(ex);
    }
};

module.exports.removeMember = async (req, res, next) => {
    try {
        const group = await groupService.removeMember(req.body, req.user.id);
        return res.json({ status: true, group });
    } catch (ex) {
        next(ex);
    }
};

module.exports.leaveGroup = async (req, res, next) => {
    try {
        const result = await groupService.leaveGroup(req.params.id, req.user.id);
        return res.json({ status: true, msg: result.msg });
    } catch (ex) {
        next(ex);
    }
};

module.exports.deleteGroup = async (req, res, next) => {
    try {
       await groupService.deleteGroup(req.params.id, req.user.id);
       return res.json({ status: true, msg: "Group deleted successfully" });
    } catch (ex) {
        next(ex);
    }
};

// --- ADVANCED ROLE MANAGEMENT & MODERATION ---

module.exports.promoteToModerator = async (req, res, next) => {
  try {
    const moderators = await groupService.promoteToModerator(req.body, req.user.id);
    return res.status(200).json({ status: true, moderators });
  } catch (ex) {
    next(ex);
  }
};

module.exports.demoteModerator = async (req, res, next) => {
  try {
    const moderators = await groupService.demoteModerator(req.body, req.user.id);
    return res.status(200).json({ status: true, moderators });
  } catch (ex) {
    next(ex);
  }
};

module.exports.promoteToAdmin = async (req, res, next) => {
  try {
    const admins = await groupService.promoteToAdmin(req.body, req.user.id);
    return res.status(200).json({ status: true, admins });
  } catch (ex) {
    next(ex);
  }
};

module.exports.kickMember = async (req, res, next) => {
    try {
        await groupService.kickMember(req.body, req.user.id);
        return res.json({ status: true, msg: "User kicked and banned from joining." });
    } catch (ex) {
        next(ex);
    }
};

// --- PUBLIC CHANNELS ---

module.exports.createChannel = async (req, res, next) => {
  try {
    const channel = await groupService.createChannel(req.body, req.user.id);
    return res.status(201).json({ status: true, channel });
  } catch (ex) {
    next(ex);
  }
};

module.exports.searchPublicChannels = async (req, res, next) => {
  try {
    const channels = await groupService.searchPublicChannels(req.query.query);
    return res.status(200).json({ status: true, channels });
  } catch (ex) {
    next(ex);
  }
};

module.exports.joinChannel = async (req, res, next) => {
  try {
    const channel = await groupService.joinChannel(req.body, req.user.id);
    return res.status(200).json({ status: true, channel });
  } catch (ex) {
    next(ex);
  }
};