const User = require("../models/User");

module.exports.uploadKeyBundle = async (req, res, next) => {
  try {
    const userId = req.user.id; // Extracted from verifyToken middleware
    const { identityKey, registrationId, signedPreKey, preKeys } = req.body;
    
    // ✅ FIX: Payload validation to prevent massive strings that could crash clients parsing the JSON
    if (identityKey && typeof identityKey === "string" && identityKey.length > 5000) {
      return res.status(400).json({ status: false, msg: "Payload too large." });
    }

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
      return res.status(404).json({ status: false, hasKeys: false, msg: "Target user has no E2E keys. They need to log out and back in." });
    }

    // ✅ CRITICAL FIX: Perfect Forward Secrecy (PFS)
    // Shift the first pre-key out of the array and save the user.
    // If none are left, oneTimePreKey is undefined, and the frontend must fallback to signedPreKey.
    let oneTimePreKey = undefined;
    
    if (user.e2eKeys.preKeys && user.e2eKeys.preKeys.length > 0) {
      oneTimePreKey = user.e2eKeys.preKeys.shift(); // Remove it from the array
      // Save the array so this key can never be given out again
      await User.findByIdAndUpdate(targetUserId, { 
        $set: { "e2eKeys.preKeys": user.e2eKeys.preKeys } 
      });
    }

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