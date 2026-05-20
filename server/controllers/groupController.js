const groupService = require('../services/groupService');

const createGroup = async (req, res, next) => {
  try {
    const { name, members } = req.body;
    const creatorId = req.user._id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    const group = await groupService.createGroup(name, creatorId, members);
    
    return res.status(201).json({
      success: true,
      data: group
    });
  } catch (error) {
    next(error);
  }
};

const getGroups = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const groups = await groupService.getUserGroups(userId);
    
    return res.status(200).json({
      success: true,
      count: groups.length,
      data: groups
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  getGroups
};
