const User = require("../models/User");

module.exports.uploadKeyBundle = async (req, res, next) => {
  try {
    const userId = req.user.id; // Extracted from verifyToken middleware
    const { identityKey, registrationId, signedPreKey, preKeys } = req.body;
    
    await User.findByIdAndUpdate(userId, {
      e2eKeys: { identityKey, registrationId, signedPreKey, preKeys }
    });

    return res.json({ status: true, msg: "E2E Key Bundle uploaded successfully." });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getKeyBundle = async (req, res, next) => {
  try {
    const { targetUserId } = req.params;
    const user = await User.findById(targetUserId).select("e2eKeys");

    if (!user || !user.e2eKeys || !user.e2eKeys.identityKey) {
      return res.status(404).json({ status: false, msg: "Target user E2E keys not found." });
    }

    // "Pop" one pre-key off the array to give to the requester
    // This ensures perfect forward secrecy (the key is single-use)
    const oneTimePreKey = user.e2eKeys.preKeys.pop();
    
    if (oneTimePreKey) {
        // Save the user to register that this one-time key has been consumed
        await user.save();
    }

    return res.json({
      status: true,
      bundle: {
        identityKey: user.e2eKeys.identityKey,
        registrationId: user.e2eKeys.registrationId,
        signedPreKey: user.e2eKeys.signedPreKey,
        preKey: oneTimePreKey // If undefined, frontend must fallback to using just the signedPreKey
      }
    });
  } catch (ex) {
    next(ex);
  }
};

module.exports.uploadMorePreKeys = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { preKeys } = req.body;

    await User.findByIdAndUpdate(userId, {
      $push: { "e2eKeys.preKeys": { $each: preKeys } }
    });

    return res.json({ status: true, msg: "New E2E Pre-Keys added successfully." });
  } catch (ex) {
    next(ex);
  }
};