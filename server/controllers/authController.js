const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { registerSchema, loginSchema } = require("../utils/validation"); 

// --- LEVEL 2: REDIS CACHING SETUP ---
const { createClient } = require("redis");
const cacheClient = createClient({ url: process.env.REDIS_URI || "redis://localhost:6379" });
cacheClient.connect().catch(err => console.error("Cache Client Error:", err));

// STEP 5: Import Meilisearch User Index
const { userIndex } = require("../utils/meilisearch");

// Safe API constants for Fallback avatar generation
const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

// Helper to generate both tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ id: userId }, process.env.REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

module.exports.register = async (req, res, next) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message, status: false });

    const { username, email, password, gender, avatarImage, publicKey } = req.body;

    const usernameCheck = await User.findOne({ username });
    if (usernameCheck) return res.json({ msg: "Username already used", status: false });

    const emailCheck = await User.findOne({ email });
    if (emailCheck) return res.json({ msg: "Email already used", status: false });

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
      publicKey: publicKey 
    });

    // STEP 5 FIX: Sync new user to Meilisearch
    try {
      await userIndex.addDocuments([{
        id: user._id.toString(),
        username: user.username,
        email: user.email // Make email searchable as well
      }]);
    } catch (e) {
      console.error("Failed to sync user to Meilisearch", e.message);
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true, 
      sameSite: "None", 
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

    // STEP 4 FIX: Secure the access token in an HttpOnly cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true, 
      sameSite: "None", 
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({ status: true, user: userResponse, token: accessToken }); 
  } catch (ex) {
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

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true, 
      sameSite: "None", 
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // STEP 4 FIX: Secure the access token in an HttpOnly cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true, 
      sameSite: "None", 
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({ status: true, user: userResponse, token: accessToken });
  } catch (ex) {
    next(ex);
  }
};

module.exports.logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const accessToken = req.cookies.accessToken;
    
    // --- SECURITY ENHANCEMENT: REDIS BLACKLISTING ---
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

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true, 
      sameSite: "None", 
    });
    
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: true, 
      sameSite: "None", 
    });
    
    return res.json({ status: true, msg: "Logged out successfully" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.sendStatus(401);

  if (cacheClient.isReady) {
      const isBlacklisted = await cacheClient.get(`bl_${refreshToken}`);
      if (isBlacklisted) return res.sendStatus(403); 
  }

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);
    const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: "15m" });
    
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true, 
      sameSite: "None", 
      maxAge: 15 * 60 * 1000, 
    });

    res.json({ status: true, token: accessToken });
  });
};

// --- STEP 5 FIX: MEILISEARCH INTEGRATION FOR TYPO-TOLERANT FAST SEARCH ---
module.exports.getAllUsers = async (req, res, next) => {
  try {
    const currentUserId = req.params.id;
    const searchQuery = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; 
    const skip = (page - 1) * limit;

    let userIds = [];

    // Hit Meilisearch instead of MongoDB Regex if there is a search query
    if (searchQuery) {
      try {
        const searchResults = await userIndex.search(searchQuery, {
          limit,
          offset: skip
        });
        
        // Extract IDs and filter out the current user
        userIds = searchResults.hits
          .map(hit => hit.id)
          .filter(id => id !== currentUserId);

      } catch (meiliErr) {
        console.warn("⚠️ Meilisearch failed, falling back to MongoDB Regex:", meiliErr.message);
        // Fallback to old regex if Meilisearch is down
        const usersBasic = await User.find({ 
          _id: { $ne: currentUserId }, 
          username: { $regex: searchQuery, $options: "i" } 
        }).select("_id").skip(skip).limit(limit);
        userIds = usersBasic.map(u => u._id.toString());
      }
    } else {
      // Standard paginated fetch if no query
      const usersBasic = await User.find({ _id: { $ne: currentUserId } })
        .select("_id").skip(skip).limit(limit);
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
      console.warn("⚠️ Redis cache unavailable, falling back to DB directly.");
      cachedProfiles = new Array(userIds.length).fill(null);
    }

    cachedProfiles.forEach((profileStr, index) => {
      if (profileStr) {
        finalUsersRaw.push(JSON.parse(profileStr));
      } else {
        cacheMisses.push(userIds[index]);
      }
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
            missedUsers.forEach(user => cacheClient.expire(`user_profile:${user._id.toString()}`, 3600));
          }
        } catch (redisSaveErr) {}
      }
    }

    const finalUsers = finalUsersRaw.map(u => {
        if (u.privacySettings?.profilePhoto === "nobody") {
            u.avatarImage = ""; 
        }
        return u;
    });

    return res.json(finalUsers);
  } catch (ex) {
    next(ex);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { statusMessage, statusIcon, bio, interests, privacySettings } = req.body;
    
    let updatePayload = { statusMessage, statusIcon, bio, interests };
    
    if (privacySettings) {
        const currentUser = await User.findById(userId);
        updatePayload.privacySettings = {
            ...currentUser.privacySettings,
            ...privacySettings
        };
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updatePayload,
      { new: true }
    ).select([
        "email", "username", "avatarImage", "gender", "_id", 
        "statusMessage", "statusIcon", "bio", "interests", "privacySettings", "chatCustomizations"
    ]);

    // STEP 5 FIX: Sync potential username updates to Meilisearch
    if (user.username) {
        try {
            await userIndex.updateDocuments([{ id: userId, username: user.username }]);
        } catch (e) {}
    }

    const userResponse = user.toObject();
    
    try {
      if (cacheClient.isReady) {
        await cacheClient.setEx(`user_profile:${userId}`, 3600, JSON.stringify(userResponse));
      }
    } catch (e) {
      console.warn("⚠️ Redis unavailable, skipping cache update.");
    }

    return res.json({ status: true, user: userResponse });
  } catch (ex) {
    next(ex);
  }
};

module.exports.toggleBlockUser = async (req, res, next) => {
  try {
    const { userId, blockedUserId } = req.body;
    const user = await User.findById(userId);
    
    if (user.blockedUsers.includes(blockedUserId)) {
        user.blockedUsers.pull(blockedUserId); 
    } else {
        user.blockedUsers.push(blockedUserId);
    }
    await user.save();
    return res.json({ status: true, blockedUsers: user.blockedUsers });
  } catch (ex) {
    next(ex);
  }
};

module.exports.updateFcmToken = async (req, res, next) => {
  try {
    const { userId, fcmToken } = req.body;
    await User.findByIdAndUpdate(userId, { fcmToken });
    return res.json({ status: true, msg: "FCM Token updated" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.updatePublicKey = async (req, res, next) => {
  try {
    const { userId, publicKey } = req.body;
    await User.findByIdAndUpdate(userId, { publicKey });
    return res.json({ status: true, msg: "Public Key registered for E2EE" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getPublicKey = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("publicKey");
    return res.json({ status: true, publicKey: user.publicKey });
  } catch (ex) {
    next(ex);
  }
};

// --- FETCH USER BY ID FOR QR SCANNER ---
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

// --- MERGE UPDATE: CHAT CUSTOMIZATION (WALLPAPERS & THEMES) ---
module.exports.updateChatCustomization = async (req, res, next) => {
  try {
    const { userId, chatId, wallpaper, themeColor } = req.body;
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
    
    // Update Redis cache so the frontend gets the latest wallpaper immediately on refresh
    const userResponse = user.toObject();
    try {
      if (cacheClient.isReady) {
        await cacheClient.setEx(`user_profile:${userId}`, 3600, JSON.stringify(userResponse));
      }
    } catch (e) {
      console.warn("⚠️ Redis unavailable, skipping cache update.");
    }

    return res.json({ status: true, customizations: user.chatCustomizations });
  } catch (ex) {
    next(ex);
  }
};