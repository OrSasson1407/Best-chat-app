const Group = require('../models/GroupModel');
const User = require('../models/User');
const logger = require('../utils/logger');

class GroupService {
  async createGroup(name, creatorId, members = []) {
    try {
      // Ensure the creator is always part of the group and there are no duplicate IDs
      const uniqueMembers = [...new Set([creatorId, ...members])];
      
      const newGroup = new Group({
        name,
        members: uniqueMembers,
        admin: creatorId
      });
      
      return await newGroup.save();
    } catch (error) {
      logger.error(`Error in createGroup: ${error.message}`);
      throw new Error('Failed to create group');
    }
  }

  async getUserGroups(userId) {
    try {
      // Fetch all groups where the user is a member
      return await Group.find({ members: userId })
        .sort({ updatedAt: -1 })
        .populate('members', 'username avatar email')
        .populate('admin', 'username');
    } catch (error) {
      logger.error(`Error in getUserGroups: ${error.message}`);
      throw new Error('Failed to fetch user groups');
    }
  }
}

module.exports = new GroupService();
