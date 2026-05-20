const messageService = require('../services/messageService');

const getMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    if (!groupId) {
      return res.status(400).json({ success: false, message: 'Group ID is required' });
    }

    const messages = await messageService.getMessagesByGroup(groupId, page, limit);
    
    return res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    next(error); 
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user._id; 
    const { groupId, content, type } = req.body;

    if (!groupId || !content) {
      return res.status(400).json({ success: false, message: 'Group ID and content are required' });
    }

    const message = await messageService.saveMessage(senderId, groupId, content, type);

    return res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMessages,
  sendMessage
};
