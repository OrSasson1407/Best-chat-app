// server/services/authService.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

class AuthService {
  generateTokens(userId) {
    const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: userId }, process.env.REFRESH_SECRET, { expiresIn: "7d" });
    return { accessToken, refreshToken };
  }

  async registerUser(userData) {
    const { username, email, password, gender, avatarImage, publicKey } = userData;

    const usernameCheck = await User.findOne({ username });
    if (usernameCheck) throw new Error("Username already used");

    const emailCheck = await User.findOne({ email });
    if (emailCheck) throw new Error("Email already used");

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

    const tokens = this.generateTokens(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;

    return { user: userResponse, tokens };
  }

  async loginUser(username, password) {
    const user = await User.findOne({ username });
    if (!user) throw new Error("Incorrect Username or Password");

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error("Incorrect Username or Password");

    const tokens = this.generateTokens(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;

    return { user: userResponse, tokens };
  }
}

module.exports = new AuthService();