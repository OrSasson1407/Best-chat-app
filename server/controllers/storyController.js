const storyService = require("../services/storyService");

exports.addStory = async (req, res, next) => {
  try {
    const newStory = await storyService.addStory(req.body, req.user.id);

    // Emit via Socket.io to notify online users about the new story
    const io = req.app.get("io");
    if (io) {
       // Broadcast the new story event so clients can show the status ring
       io.emit("new-story-published", { userId: req.user.id, storyId: newStory._id });
    }

    return res.status(201).json({ status: true, story: newStory });
  } catch (error) {
    next(error);
  }
};

exports.getFeed = async (req, res, next) => {
  try {
    const feed = await storyService.getFeed(req.user.id);
    return res.status(200).json({ status: true, feed });
  } catch (error) {
    next(error);
  }
};

exports.viewStory = async (req, res, next) => {
  try {
    await storyService.viewStory(req.params.storyId, req.user.id);
    return res.status(200).json({ status: true, msg: "Story marked as viewed" });
  } catch (error) {
    next(error);
  }
};