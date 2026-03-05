const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { registerSchema, loginSchema } = require("../utils/validation"); // Path to your Joi schemas

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
    // 1. Sanitize Input using Joi
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message, status: false });

    const { username, email, password, gender, avatarImage } = req.body;

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
    });

    // 2. Generate Tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // 3. Store Refresh Token in httpOnly Cookie for security
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
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
    // 1. Sanitize Input
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message, status: false });

    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.json({ msg: "Incorrect Username or Password", status: false });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.json({ msg: "Incorrect Username or Password", status: false });

    // 2. Refresh Token Pattern
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({ status: true, user: userResponse, token: accessToken });
  } catch (ex) {
    next(ex);
  }
};

// 4. NEW: Refresh Token Endpoint
module.exports.refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.sendStatus(401);

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);
    const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: "15m" });
    res.json({ status: true, token: accessToken });
  });
};

module.exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.params.id } }).select([
      "email", "username", "avatarImage", "gender", "_id", 
      "statusMessage", "statusIcon", "bio", "interests"
    ]);
    return res.json(users);
  } catch (ex) {
    next(ex);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { statusMessage, statusIcon, bio, interests } = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { statusMessage, statusIcon, bio, interests },
      { new: true }
    );

    const userResponse = user.toObject();
    delete userResponse.password;
    
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