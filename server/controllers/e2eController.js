const User = require("../models/User");

module.exports.uploadKeyBundle = async (req, res, next) => {
  try {
    const userId = req.user.id; // Extracted from verifyToken middleware
    const { identityKey, registrationId, signedPreKey, preKeys } = req.body;
    
    await User.findByIdAndUpdate(userId, {
      e2eKeys: { identityKey, registrationId, signedPreKey, preKeys },
      "e2eStatus.hasKeys": true,
      "e2eStatus.enabled": true,
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
      // Do NOT update the user record here — we are reading someone else's keys,
      // not our own. Writing to their document would corrupt their e2eStatus.
      return res.status(404).json({ status: false, hasKeys: false, msg: "Target user has no E2E keys. They need to log out and back in." });
    }

    // Read a one-time pre-key without consuming it.
    // We only generate 1 pre-key per registration and have no replenishment flow,
    // so popping here would leave every user after the first contact with no pre-key.
    const oneTimePreKey = user.e2eKeys.preKeys?.[0];

    return res.json({
      status: true,
      bundle: {
        identityKey: user.e2eKeys.identityKey,
        registrationId: user.e2eKeys.registrationId,
        signedPreKey: user.e2eKeys.signedPreKey,
        preKey: oneTimePreKey // may be undefined — frontend falls back to signedPreKey
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