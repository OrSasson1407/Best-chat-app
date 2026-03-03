const User = require("../models/User");
const bcrypt = require("bcryptjs");

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

    // Provide default valid API URL if user skipped selecting one
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

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({ status: true, user: userResponse });
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

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({ status: true, user: userResponse });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getAllUsers = async (req, res, next) => {
  try {
    // Select all the newly added fields to populate the UI (including avatar, gender, and bio info)
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
    
    // Find the user and update their custom profile status and bio
    const user = await User.findByIdAndUpdate(
      userId,
      { statusMessage, statusIcon, bio, interests },
      { new: true } // Returns the newly updated document
    );

    const userResponse = user.toObject();
    delete userResponse.password;
    
    return res.json({ status: true, user: userResponse });
  } catch (ex) {
    next(ex);
  }
};