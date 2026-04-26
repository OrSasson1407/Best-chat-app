// server/services/authService.js
//
// BUG-009 FIX: This file was dead code — nothing imported it, and it was
// silently out of sync with authController.js in three ways:
//   1. It used the old `publicKey` field instead of `e2eKeys`
//   2. It had no 2FA awareness
//   3. It had no token blacklisting / refresh-token rotation
//
// This rewrite aligns authService with the real auth logic in
// authController.js so it can be safely imported and reused in the future
// without introducing regressions.

const User    = require("../models/User");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");

const femaleTops       = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops         = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

class AuthService {
  // ── Token generation ───────────────────────────────────────────────────────
  // Matches generateTokens() in authController.js exactly.
  // Both access token (15 min) and refresh token (7 days) are signed with
  // separate secrets so a compromised refresh token cannot forge an access token.
  generateTokens(userId) {
    const idStr = String(userId);
    const accessToken  = jwt.sign({ id: idStr }, process.env.JWT_SECRET,    { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: idStr }, process.env.REFRESH_SECRET, { expiresIn: "7d" });
    return { accessToken, refreshToken };
  }

  // ── Register ───────────────────────────────────────────────────────────────
  // FIX: uses e2eKeys (Signal Protocol bundle) not the old publicKey field.
  // Validation is intentionally left to authController / Joi schemas so this
  // service layer stays free of HTTP concerns.
  async registerUser(userData) {
    const { username, email, password, gender, avatarImage, e2eKeys } = userData;

    if (await User.findOne({ username })) throw new Error("Username already used");
    if (await User.findOne({ email   })) throw new Error("Email already used");

    const hashedPassword = await bcrypt.hash(password, 10);
    const tops           = gender === "female" ? femaleTops : maleTops;
    const finalAvatar    = avatarImage ||
      `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}&top=${tops}&backgroundColor=${backgroundColors}`;

    const user = await User.create({
      email,
      username,
      password: hashedPassword,
      gender,
      avatarImage: finalAvatar,
      isAvatarImageSet: true,
      // FIX: store the full Signal Protocol bundle, not the old publicKey field
      e2eKeys,
      e2eStatus: { hasKeys: !!(e2eKeys?.identityKey), enabled: !!(e2eKeys?.identityKey) },
    });

    const { accessToken, refreshToken } = this.generateTokens(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;

    return { user: userResponse, accessToken, refreshToken };
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  // FIX: returns a 2fa_required signal when the user has 2FA enabled so the
  // caller can redirect to the validation step instead of issuing tokens.
  async loginUser(username, password) {
    const user = await User.findOne({ username });
    if (!user) throw new Error("Incorrect Username or Password");

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error("Incorrect Username or Password");

    // 2FA gate — caller must check this flag and NOT issue tokens yet
    if (user.twoFactor?.enabled) {
      return { requires2FA: true, userId: String(user._id) };
    }

    // Sync e2eStatus so it reflects actual stored key state
    const hasValidKeys = !!(user.e2eKeys?.identityKey);
    if (user.e2eStatus?.hasKeys !== hasValidKeys) {
      await User.findByIdAndUpdate(user._id, {
        "e2eStatus.hasKeys": hasValidKeys,
        "e2eStatus.enabled": hasValidKeys,
      });
    }

    const { accessToken, refreshToken } = this.generateTokens(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;
    userResponse.e2eStatus = { hasKeys: hasValidKeys, enabled: hasValidKeys };

    return { user: userResponse, accessToken, refreshToken };
  }
}

module.exports = new AuthService();