const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { registerSchema, loginSchema } = require("../utils/validation"); 

// --- LEVEL 2: REDIS CACHING SETUP ---
const { createClient } = require("redis");
const cacheClient = createClient({ url: process.env.REDIS_URI || "redis://localhost:6379" });
cacheClient.connect().catch(err => console.error("Cache Client Error:", err));

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

    // --- FIX: Destructure publicKey from req.body ---
    const { username, email, password, gender, avatarImage, publicKey } = req.body;

    const usernameCheck = await User.findOne({ username });
    if (usernameCheck) return res.json({ msg: "Username already used", status: false });

    const emailCheck = await User.findOne({ email });
    if (emailCheck) return res.json({ msg: "Email already used", status: false });

    const hashedPassword = await bcrypt.hash(password, 10);

    const tops = gender === 'female' ? femaleTops : maleTops;
    const finalAvatar = avatarImage || `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}&top=${tops}&backgroundColor=${backgroundColors}`;

    // --- FIX: Save publicKey in the database ---
    const user = await User.create({
      email,
      username,
      password: hashedPassword,
      gender,
      avatarImage: finalAvatar,
      isAvatarImageSet: true,
      publicKey: publicKey 
    });

    const { accessToken, refreshToken } = generateTokens(user._id);

    // --- PRODUCTION CORS FIX ---
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true, 
      sameSite: "None", 
      maxAge: 7 * 24 * 60 * 60 * 1000, 
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

    // --- PRODUCTION CORS FIX ---
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true, 
      sameSite: "None", 
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({ status: true, user: userResponse, token: accessToken });
  } catch (ex) {
    next(ex);
  }
};

module.exports.logout = (req, res, next) => {
  try {
    // --- PRODUCTION CORS FIX ---
    res.clearCookie("refreshToken", {
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

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);
    const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: "15m" });
    res.json({ status: true, token: accessToken });
  });
};

// --- HIGH-PERFORMANCE REDIS MGET CACHING WITH PRIVACY ENFORCEMENT ---
module.exports.getAllUsers = async (req, res, next) => {
  try {
    const currentUserId = req.params.id;

    const searchQuery = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; 
    const skip = (page - 1) * limit;

    const dbQuery = { _id: { $ne: currentUserId } };
    
    if (searchQuery) {
        dbQuery.username = { $regex: searchQuery, $options: "i" };
    }

    const usersBasic = await User.find(dbQuery).select("_id").skip(skip).limit(limit);
                                 
    if (usersBasic.length === 0) return res.json([]);

    const userIds = usersBasic.map(u => u._id.toString());
    const cacheKeys = userIds.map(id => `user_profile:${id}`);

    const cachedProfiles = await cacheClient.mGet(cacheKeys);

    let finalUsersRaw = [];
    let cacheMisses = []; 

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
        "statusMessage", "statusIcon", "bio", "interests", "privacySettings" // Added privacySettings
      ]);

      const msetArgs = [];
      missedUsers.forEach(user => {
        const userObj = user.toObject();
        finalUsersRaw.push(userObj);
        msetArgs.push(`user_profile:${user._id.toString()}`);
        msetArgs.push(JSON.stringify(userObj));
      });

      if (msetArgs.length > 0) {
        await cacheClient.mSet(msetArgs);
        missedUsers.forEach(user => cacheClient.expire(`user_profile:${user._id.toString()}`, 3600));
      }
    }

    // --- MERGE UPDATE: Apply Privacy Settings before sending to frontend ---
    const finalUsers = finalUsersRaw.map(u => {
        // If they set profilePhoto to nobody, scrub it.
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
    
    // Merge new privacy settings with existing ones if provided
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
        "statusMessage", "statusIcon", "bio", "interests", "privacySettings"
    ]);

    const userResponse = user.toObject();
    
    // TARGETED INVALIDATION: Update only this user's cache immediately
    await cacheClient.setEx(`user_profile:${userId}`, 3600, JSON.stringify(userResponse));

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