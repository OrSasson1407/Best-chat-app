const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken"); // NEW: Required for token generation

// Safe API constants for Fallback avatar generation
const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

module.exports.register = async (req, res, next) => {
  try {
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

    // --- NEW: Generate JWT Token for registration ---
    const payload = { user: { id: user._id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    const userResponse = user.toObject();
    delete userResponse.password;

    // Return both user and token to the frontend
    return res.json({ status: true, user: userResponse, token }); 
  } catch (ex) {
    next(ex);
  }
};

module.exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.json({ msg: "Incorrect Username or Password", status: false });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.json({ msg: "Incorrect Username or Password", status: false });

    // --- NEW: Generate JWT Token for login ---
    const payload = { user: { id: user._id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    const userResponse = user.toObject();
    delete userResponse.password;

    // Return both user and token to the frontend
    return res.json({ status: true, user: userResponse, token });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.params.id } }).select([
      "email", 
      "username", 
      "avatarImage", 
      "gender", 
      "_id", 
      "statusMessage", 
      "statusIcon", 
      "bio", 
      "interests"
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