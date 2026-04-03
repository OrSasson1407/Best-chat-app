const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose"); 
const { registerSchema, loginSchema } = require("../utils/validation"); 

const { createRedisClient } = require("../config/redis");
const cacheClient = createRedisClient();

cacheClient.on("error", (err) => {
  console.warn("[Redis] Auth Cache Client Error:", err.message);
});

cacheClient.connect().catch(() => {
  console.warn("[Redis] Failed to connect on startup. Operating in degraded mode.");
});

const { userIndex } = require("../utils/meilisearch");

const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

// ✅ FIX: Cast userId to String() before creating the JWT to prevent BSON Object errors
const generateTokens = (userId) => {
  const idStr = String(userId);
  const accessToken = jwt.sign({ id: idStr }, process.env.JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ id: idStr }, process.env.REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

module.exports.register = async (req, res, next) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message, status: false });

    const { username, email, password, gender, avatarImage, e2eKeys } = req.body;

    const usernameCheck = await User.findOne({ username });
    if (usernameCheck) return res.status(409).json({ msg: "Username already used", status: false });

    const emailCheck = await User.findOne({ email });
    if (emailCheck) return res.status(409).json({ msg: "Email already used", status: false });

    const hashedPassword = await bcrypt.hash(password, 10);

    const tops = gender === 'female' ? femaleTops : maleTops;
    const finalAvatar = avatarImage || `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}&top=${tops}&backgroundColor=${backgroundColors}`;

    const user = await User.create({
      email,
      username,
      password: hashedPassword,
      gender,
      avatarImage: finalAvatar,
      isAvatarImageSet: true,
      e2eKeys 
    });

    try {
      await userIndex.addDocuments([{
        id: user._id.toString(),
        username: user.username,
        email: user.email 
      }]);
    } catch (e) {
      console.error("[Meilisearch] Failed to sync new user:", e.message);
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    const userResponse = user.toObject();
    delete userResponse.password;

    console.log(`[Auth] User registered successfully: ${username}`);
    
    return res.json({ 
      status: true, 
      user: userResponse, 
      token: accessToken, 
      refreshToken: refreshToken 
    }); 
  } catch (ex) {
    console.error("[Auth] Registration error:", ex);
    next(ex);
  }
};

module.exports.login = async (req, res, next) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message, status: false });

    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.json({ msg: "Incorrect Username or Password", status: false });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.json({ msg: "Incorrect Username or Password", status: false });

    const { accessToken, refreshToken } = generateTokens(user._id);

    const userResponse = user.toObject();
    delete userResponse.password;

    console.log(`[Auth] User logged in successfully: ${username}`);
    
    return res.json({ 
      status: true, 
      user: userResponse, 
      token: accessToken,
      refreshToken: refreshToken
    });
  } catch (ex) {
    console.error("[Auth] Login error:", ex);
    next(ex);
  }
};

module.exports.logout = async (req, res, next) => {
  try {
    let accessToken = req.header("Authorization");
    if (accessToken && accessToken.startsWith("Bearer ")) {
      accessToken = accessToken.replace("Bearer ", "").trim();
    }
    
    const refreshToken = req.body.refreshToken; 
    
    if (cacheClient.isReady) {
        if (refreshToken) {
            const decoded = jwt.decode(refreshToken);
            if (decoded && decoded.exp) {
                const timeToLive = decoded.exp - Math.floor(Date.now() / 1000);
                if (timeToLive > 0) {
                    await cacheClient.setEx(`bl_${refreshToken}`, timeToLive, "revoked");
                }
            }
        }
        
        if (accessToken) {
            const decodedAccess = jwt.decode(accessToken);
            if (decodedAccess && decodedAccess.exp) {
                const timeToLiveAccess = decodedAccess.exp - Math.floor(Date.now() / 1000);
                if (timeToLiveAccess > 0) {
                    await cacheClient.setEx(`bl_${accessToken}`, timeToLiveAccess, "revoked");
                }
            }
        }
    }

    console.log("[Auth] User logged out and tokens blacklisted.");
    return res.json({ status: true, msg: "Logged out successfully" });
  } catch (ex) {
    console.error("[Auth] Logout error:", ex);
    next(ex);
  }
};

module.exports.refreshToken = async (req, res) => {
  const refreshToken = req.body.refreshToken;
  if (!refreshToken) return res.sendStatus(401);

  if (cacheClient.isReady) {
      const isBlacklisted = await cacheClient.get(`bl_${refreshToken}`);
      if (isBlacklisted) return res.sendStatus(403); 
  }

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);
    const accessToken = jwt.sign({ id: String(decoded.id) }, process.env.JWT_SECRET, { expiresIn: "15m" });
    
    res.json({ status: true, token: accessToken });
  });
};

module.exports.getAllUsers = async (req, res, next) => {
  try {
    const currentUserId = req.params.id;
    const searchQuery = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; 
    const skip = (page - 1) * limit;

    let userIds = [];

    if (searchQuery) {
      try {
        const searchResults = await userIndex.search(searchQuery, { limit, offset: skip });
        userIds = searchResults.hits.map(hit => hit.id).filter(id => id !== currentUserId);
      } catch (meiliErr) {
        console.warn("[Meilisearch] Failed, falling back to MongoDB Regex:", meiliErr.message);
        const usersBasic = await User.find({ 
          _id: { $ne: currentUserId }, username: { $regex: searchQuery, $options: "i" } 
        }).select("_id").skip(skip).limit(limit);
        userIds = usersBasic.map(u => u._id.toString());
      }
    } else {
      const usersBasic = await User.find({ _id: { $ne: currentUserId } }).select("_id").skip(skip).limit(limit);
      userIds = usersBasic.map(u => u._id.toString());
    }
                                         
    if (userIds.length === 0) return res.json([]);

    const cacheKeys = userIds.map(id => `user_profile:${id}`);

    let cachedProfiles = [];
    let finalUsersRaw = [];
    let cacheMisses = []; 

    try {
      if (cacheClient.isReady) {
        cachedProfiles = await cacheClient.mGet(cacheKeys);
      } else {
        throw new Error("Redis client not connected");
      }
    } catch (redisErr) {
      console.warn("[Redis] Cache unavailable, falling back to DB directly.");
      cachedProfiles = new Array(userIds.length).fill(null);
    }

    cachedProfiles.forEach((profileStr, index) => {
      if (profileStr) finalUsersRaw.push(JSON.parse(profileStr));
      else cacheMisses.push(userIds[index]);
    });

    if (cacheMisses.length > 0) {
      const missedUsers = await User.find({ _id: { $in: cacheMisses } }).select([
        "email", "username", "avatarImage", "gender", "_id", 
        "statusMessage", "statusIcon", "bio", "interests", "privacySettings" 
      ]);

      const msetArgs = [];
      missedUsers.forEach(user => {
        const userObj = user.toObject();
        finalUsersRaw.push(userObj);
        msetArgs.push(`user_profile:${user._id.toString()}`);
        msetArgs.push(JSON.stringify(userObj));
      });

      if (msetArgs.length > 0) {
        try {
          if (cacheClient.isReady) {
            await cacheClient.mSet(msetArgs);
            await Promise.all(
              missedUsers.map(user =>
                cacheClient.expire(`user_profile:${user._id.toString()}`, 3600)
              )
            );
          }
        } catch (redisSaveErr) {
            console.warn("[Redis] Failed to cache user profiles:", redisSaveErr.message);
        }
      }
    }

    const finalUsers = finalUsersRaw.map(u => {
        if (u.privacySettings?.profilePhoto === "nobody") u.avatarImage = ""; 
        return u;
    });

    return res.json(finalUsers);
  } catch (ex) {
    console.error("[API] Failed to get all users:", ex);
    next(ex);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.params.id;

    // ✅ FIX: Strict String casting to prevent MongoDB object equality mismatch
    if (String(userId) !== String(req.user.id)) {
      return res.status(403).json({ status: false, msg: "Forbidden: You cannot modify another user's profile." });
    }

    const { statusMessage, statusIcon, bio, interests, privacySettings } = req.body;
    
    let updatePayload = { statusMessage, statusIcon, bio, interests };
    
    if (privacySettings) {
        Object.keys(privacySettings).forEach(key => {
            updatePayload[`privacySettings.${key}`] = privacySettings[key];
        });
    }

    const user = await User.findByIdAndUpdate(userId, updatePayload, { new: true }).select([
        "email", "username", "avatarImage", "gender", "_id", 
        "statusMessage", "statusIcon", "bio", "interests", "privacySettings", "chatCustomizations"
    ]);

    if (!user) return res.status(404).json({ status: false, msg: "User not found." });

    if (user.username) {
        try { await userIndex.updateDocuments([{ id: userId, username: user.username }]); } 
        catch (e) { console.error("[Meilisearch] Failed to update user docs:", e.message); }
    }

    const userResponse = user.toObject();
    
    try {
      if (cacheClient.isReady) await cacheClient.setEx(`user_profile:${userId}`, 3600, JSON.stringify(userResponse));
    } catch (e) {
      console.warn("[Redis] Unavailable, skipping profile cache update.");
    }

    return res.json({ status: true, user: userResponse });
  } catch (ex) {
    next(ex);
  }
};

module.exports.toggleBlockUser = async (req, res, next) => {
  try {
    const { userId, blockedUserId } = req.body;

    // ✅ FIX: Strict String casting
    if (String(userId) !== String(req.user.id)) {
      return res.status(403).json({ status: false, msg: "Forbidden: You cannot modify another user's block list." });
    }

    const user = await User.findById(userId);
    
    if (user.blockedUsers.includes(blockedUserId)) user.blockedUsers.pull(blockedUserId); 
    else user.blockedUsers.push(blockedUserId);
    
    await user.save();
    return res.json({ status: true, blockedUsers: user.blockedUsers });
  } catch (ex) {
    next(ex);
  }
};

module.exports.updateFcmToken = async (req, res, next) => {
  try {
    const { userId, fcmToken } = req.body;

    // ✅ FIX: Strict String casting prevents false-positive 403s
    if (String(userId) !== String(req.user.id)) {
      return res.status(403).json({ status: false, msg: "Forbidden." });
    }

    await User.findByIdAndUpdate(userId, { $addToSet: { fcmTokens: fcmToken } });
    return res.json({ status: true, msg: "FCM Token registered" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.updateE2EKeys = async (req, res, next) => {
  try {
    const { userId, e2eKeys } = req.body;
    if (!userId || !e2eKeys) {
        return res.status(400).json({ status: false, msg: "Missing data" });
    }
    
    // ✅ FIX: Strict String casting
    if (String(userId) !== String(req.user.id)) {
        return res.status(403).json({ status: false, msg: "Forbidden: You cannot register keys for another user." });
    }
    
    await User.findByIdAndUpdate(userId, { e2eKeys });
    console.log(`[Crypto] E2E Keys Bundle registered for user ${userId}`);
    return res.json({ status: true, msg: "E2E Keys Bundle registered" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getPublicKey = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.json({ status: false, msg: "Invalid User ID format" });
    }

    const user = await User.findById(targetId).select("e2eKeys");
    
    if (!user) {
        return res.json({ status: false, msg: "User not found" });
    }

    if (!user.e2eKeys || !user.e2eKeys.identityKey) {
        return res.json({ status: false, msg: "E2E keys not registered for this user yet" });
    }

    return res.json({ status: true, bundle: user.e2eKeys });
  } catch (ex) {
    console.error("[Crypto] Failed to fetch public key bundle:", ex);
    next(ex);
  }
};

module.exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select([
      "email", "username", "avatarImage", "_id", "statusIcon", "statusMessage", "bio", "lastSeen"
    ]);
    if (!user) return res.status(404).json({ status: false, msg: "User not found." });
    
    return res.status(200).json({ status: true, user });
  } catch (ex) {
    next(ex);
  }
};

module.exports.updateChatCustomization = async (req, res, next) => {
  try {
    const { userId, chatId, wallpaper, themeColor } = req.body;

    // ✅ FIX: Strict String casting
    if (String(userId) !== String(req.user.id)) {
      return res.status(403).json({ status: false, msg: "Forbidden." });
    }

    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ msg: "User not found", status: false });

    const index = user.chatCustomizations.findIndex(c => c.chatId.toString() === chatId);
    if (index !== -1) {
      if (wallpaper !== undefined) user.chatCustomizations[index].wallpaper = wallpaper;
      if (themeColor !== undefined) user.chatCustomizations[index].themeColor = themeColor;
    } else {
      user.chatCustomizations.push({ chatId, wallpaper, themeColor });
    }

    await user.save();
    
    const userResponse = user.toObject();
    try {
      if (cacheClient.isReady) {
        await cacheClient.setEx(`user_profile:${userId}`, 3600, JSON.stringify(userResponse));
      }
    } catch (e) {}

    return res.json({ status: true, customizations: user.chatCustomizations });
  } catch (ex) {
    next(ex);
  }
};