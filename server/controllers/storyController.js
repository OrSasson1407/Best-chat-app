const storyService = require('../services/storyService');

const createStory = async (req, res, next) => {
  try {
    const { mediaUrl, mediaType } = req.body;
    const story = await storyService.createStory(req.user._id, mediaUrl, mediaType);
    res.status(201).json({ success: true, data: story });
  } catch (error) {
    next(error);
  }
};

const getFeed = async (req, res, next) => {
  try {
    // Assuming friends/contacts array is passed or retrieved
    const { contactIds } = req.body; 
    const stories = await storyService.getActiveStories([...contactIds, req.user._id]);
    res.status(200).json({ success: true, count: stories.length, data: stories });
  } catch (error) {
    next(error);
  }
};

module.exports = { createStory, getFeed };
