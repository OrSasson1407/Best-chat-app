// server/controllers/authController.js — Sprint 1 + Sprint 2 + Sprint 3
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { registerSchema, loginSchema } = require("../utils/validation");

// Sprint 1 — 2FA
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const crypto = require("crypto");

const { createRedisClient } = require("../config/redis");
const cacheClient = createRedisClient();
cacheClient.on("error", (err) => console.warn("[Redis] Auth Cache Client Error:", err.message));
cacheClient.connect().catch(() => console.warn("[Redis] Failed to connect on startup. Operating in degraded mode."));

const { userIndex } = require("../utils/meilisearch");

const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

const generateTokens = (userId) => {
  const idStr = String(userId);
  const accessToken  = jwt.sign({ id: idStr }, process.env.JWT_SECRET,    { expiresIn: "15m" });
  const refreshToken = jwt.sign({ id: idStr }, process.env.REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

// ─── REGISTER ────────────────────────────────────────────────────────────────

module.exports.register = async (req, res, next) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message, status: false });

    const { username, email, password, gender, avatarImage, e2eKeys } = req.body;

    if (await User.findOne({ username })) return res.status(409).json({ msg: "Username already used", status: false });
    if (await User.findOne({ email }))    return res.status(409).json({ msg: "Email already used", status: false });

    const hashedPassword = await bcrypt.hash(password, 10);
    const tops = gender === "female" ? femaleTops : maleTops;
    const finalAvatar = avatarImage || `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}&top=${tops}&backgroundColor=${backgroundColors}`;

    const user = await User.create({
      email, username, password: hashedPassword, gender,
      avatarImage: finalAvatar, isAvatarImageSet: true,
      e2eKeys, e2eStatus: { hasKeys: true, enabled: true },
    });

    try { await userIndex.addDocuments([{ id: user._id.toString(), username: user.username, email: user.email }]); }
    catch (e) { console.error("[Meilisearch] Failed to sync new user:", e.message); }

    const { accessToken, refreshToken } = generateTokens(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;

    console.log(`[Auth] User registered: ${username}`);
    return res.json({ status: true, user: userResponse, token: accessToken, refreshToken });
  } catch (ex) { console.error("[Auth] Registration error:", ex); next(ex); }
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────

module.exports.login = async (req, res, next) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message, status: false });

    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.json({ msg: "Incorrect Username or Password", status: false });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.json({ msg: "Incorrect Username or Password", status: false });

    if (user.twoFactor?.enabled) return res.json({ status: "2fa_required", userId: user._id });

    const { accessToken, refreshToken } = generateTokens(user._id);

    const hasValidKeys = !!(user.e2eKeys && user.e2eKeys.identityKey);
    const e2eStatusSynced = { hasKeys: hasValidKeys, enabled: hasValidKeys };
    if (user.e2eStatus?.hasKeys !== hasValidKeys) {
      await User.findByIdAndUpdate(user._id, { "e2eStatus.hasKeys": hasValidKeys, "e2eStatus.enabled": hasValidKeys });
    }

    const userResponse = user.toObject();
    delete userResponse.password;
    userResponse.e2eStatus = e2eStatusSynced;

    console.log(`[Auth] User logged in: ${username}`);
    return res.json({ status: true, user: userResponse, token: accessToken, refreshToken });
  } catch (ex) { console.error("[Auth] Login error:", ex); next(ex); }
};

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

module.exports.logout = async (req, res, next) => {
  try {
    let accessToken = req.header("Authorization");
    if (accessToken?.startsWith("Bearer ")) accessToken = accessToken.replace("Bearer ", "").trim();
    const refreshToken = req.body.refreshToken;

    if (cacheClient.isReady) {
      const blacklist = async (token) => {
        const decoded = jwt.decode(token);
        if (decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) await cacheClient.setEx(`bl_${token}`, ttl, "revoked");
        }
      };
      if (refreshToken) await blacklist(refreshToken);
      if (accessToken)  await blacklist(accessToken);
    } else {
      console.warn("[Auth] Redis is down. Logout requested but token blacklisting is unavailable.");
    }

    console.log("[Auth] User logged out and tokens blacklisted.");
    return res.json({ status: true, msg: "Logged out successfully" });
  } catch (ex) { console.error("[Auth] Logout error:", ex); next(ex); }
};

// ─── REFRESH TOKEN (FIXED: Rotation Added) ───────────────────────────────────

module.exports.refreshToken = async (req, res) => {
  const oldRefreshToken = req.body.refreshToken;
  if (!oldRefreshToken) return res.sendStatus(401);
  
  if (cacheClient.isReady) {
    const isBlacklisted = await cacheClient.get(`bl_${oldRefreshToken}`);
    if (isBlacklisted) return res.sendStatus(403); // Replay attack prevented
  }
  
  jwt.verify(oldRefreshToken, process.env.REFRESH_SECRET, async (err, decoded) => {
    if (err) return res.sendStatus(403);
    
    // CRITICAL FIX: Refresh Token Rotation
    // Generate both a new Access Token AND a new Refresh Token
    const newAccessToken = jwt.sign({ id: String(decoded.id) }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const newRefreshToken = jwt.sign({ id: String(decoded.id) }, process.env.REFRESH_SECRET, { expiresIn: "7d" });

    // Blacklist the old refresh token to prevent indefinite use
    if (cacheClient.isReady) {
      const ttl = 7 * 24 * 60 * 60; // 7 days in seconds
      await cacheClient.setEx(`bl_${oldRefreshToken}`, ttl, "revoked");
    }

    res.json({ status: true, token: newAccessToken, refreshToken: newRefreshToken });
  });
};

// ─── GET ALL USERS ───────────────────────────────────────────────────────────

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
        userIds = searchResults.hits.map((h) => h.id).filter((id) => id !== currentUserId);
      } catch {
        const usersBasic = await User.find({ _id: { $ne: currentUserId }, username: { $regex: searchQuery, $options: "i" } }).select("_id").skip(skip).limit(limit);
        userIds = usersBasic.map((u) => u._id.toString());
      }
    } else {
      const usersBasic = await User.find({ _id: { $ne: currentUserId } }).select("_id").skip(skip).limit(limit);
      userIds = usersBasic.map((u) => u._id.toString());
    }

    if (userIds.length === 0) return res.json([]);

    const cacheKeys = userIds.map((id) => `user_profile:${id}`);
    let cachedProfiles = [], finalUsersRaw = [], cacheMisses = [];

    try {
      cachedProfiles = cacheClient.isReady ? await cacheClient.mGet(cacheKeys) : new Array(userIds.length).fill(null);
    } catch {
      cachedProfiles = new Array(userIds.length).fill(null);
    }

    cachedProfiles.forEach((p, i) => { if (p) finalUsersRaw.push(JSON.parse(p)); else cacheMisses.push(userIds[i]); });

    if (cacheMisses.length > 0) {
      const missedUsers = await User.find({ _id: { $in: cacheMisses } }).select(["email","username","avatarImage","gender","_id","statusMessage","statusIcon","bio","interests","privacySettings","e2eStatus","lastSeen","isOnline"]);
      const msetArgs = [];
      missedUsers.forEach((u) => {
        const obj = u.toObject();
        finalUsersRaw.push(obj);
        msetArgs.push(`user_profile:${u._id}`, JSON.stringify(obj));
      });
      if (msetArgs.length && cacheClient.isReady) {
        try {
          await cacheClient.mSet(msetArgs);
          await Promise.all(missedUsers.map((u) => cacheClient.expire(`user_profile:${u._id}`, 3600)));
        } catch {}
      }
    }

    return res.json(finalUsersRaw.map((u) => { if (u.privacySettings?.profilePhoto === "nobody") u.avatarImage = ""; return u; }));
  } catch (ex) { console.error("[API] Failed to get all users:", ex); next(ex); }
};

// ─── UPDATE PROFILE ──────────────────────────────────────────────────────────

module.exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.params.id;
    if (String(userId) !== String(req.user.id)) return res.status(403).json({ status: false, msg: "Forbidden" });

    const { statusMessage, statusIcon, bio, interests, privacySettings, avatarImage } = req.body;
    let updatePayload = { statusMessage, statusIcon, bio, interests };
    if (avatarImage && typeof avatarImage === "string") updatePayload.avatarImage = avatarImage;
    if (privacySettings) Object.keys(privacySettings).forEach((k) => { updatePayload[`privacySettings.${k}`] = privacySettings[k]; });

    const user = await User.findByIdAndUpdate(userId, updatePayload, { new: true }).select(["email","username","avatarImage","gender","_id","statusMessage","statusIcon","bio","interests","privacySettings","chatCustomizations"]);
    if (!user) return res.status(404).json({ status: false, msg: "User not found." });

    try { await userIndex.updateDocuments([{ id: userId, username: user.username }]); } catch {}
    const userResponse = user.toObject();
    try { if (cacheClient.isReady) await cacheClient.setEx(`user_profile:${userId}`, 3600, JSON.stringify(userResponse)); } catch {}

    return res.json({ status: true, user: userResponse });
  } catch (ex) { next(ex); }
};

// ─── OTHER EXISTING ENDPOINTS ─────────────────────────────────────────────────

module.exports.toggleBlockUser = async (req, res, next) => {
  try {
    const { userId, blockedUserId } = req.body;
    if (String(userId) !== String(req.user.id)) return res.status(403).json({ status: false, msg: "Forbidden" });
    const user = await User.findById(userId);
    if (user.blockedUsers.includes(blockedUserId)) user.blockedUsers.pull(blockedUserId);
    else user.blockedUsers.push(blockedUserId);
    await user.save();
    return res.json({ status: true, blockedUsers: user.blockedUsers });
  } catch (ex) { next(ex); }
};

module.exports.updateFcmToken = async (req, res, next) => {
  try {
    const { userId, fcmToken } = req.body;
    if (String(userId) !== String(req.user.id)) return res.status(403).json({ status: false, msg: "Forbidden" });
    await User.findByIdAndUpdate(userId, { $addToSet: { fcmTokens: fcmToken } });
    return res.json({ status: true, msg: "FCM Token registered" });
  } catch (ex) { next(ex); }
};

module.exports.updateE2EKeys = async (req, res, next) => {
  try {
    const { userId, e2eKeys } = req.body;
    if (!userId || !e2eKeys) return res.status(400).json({ status: false, msg: "Missing data" });
    if (String(userId) !== String(req.user.id)) return res.status(403).json({ status: false, msg: "Forbidden" });
    await User.findByIdAndUpdate(userId, { e2eKeys, "e2eStatus.hasKeys": true, "e2eStatus.enabled": true });
    return res.json({ status: true, msg: "E2E Keys Bundle registered" });
  } catch (ex) { next(ex); }
};

module.exports.getPublicKey = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(targetId)) return res.json({ status: false, msg: "Invalid User ID format" });
    const user = await User.findById(targetId).select("e2eKeys");
    if (!user) return res.json({ status: false, msg: "User not found" });
    if (!user.e2eKeys?.identityKey) return res.json({ status: false, msg: "E2E keys not registered" });
    return res.json({ status: true, bundle: user.e2eKeys });
  } catch (ex) { next(ex); }
};

module.exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(["email","username","avatarImage","_id","statusIcon","statusMessage","bio","lastSeen","interests","privacySettings"]);
    if (!user) return res.status(404).json({ status: false, msg: "User not found." });
    return res.status(200).json({ status: true, user });
  } catch (ex) { next(ex); }
};

module.exports.updateChatCustomization = async (req, res, next) => {
  try {
    const { userId, chatId, wallpaper, themeColor } = req.body;
    if (String(userId) !== String(req.user.id)) return res.status(403).json({ status: false, msg: "Forbidden" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found", status: false });
    const index = user.chatCustomizations.findIndex((c) => c.chatId.toString() === chatId);
    if (index !== -1) {
      if (wallpaper !== undefined) user.chatCustomizations[index].wallpaper = wallpaper;
      if (themeColor !== undefined) user.chatCustomizations[index].themeColor = themeColor;
    } else { user.chatCustomizations.push({ chatId, wallpaper, themeColor }); }
    await user.save();
    try { if (cacheClient.isReady) await cacheClient.setEx(`user_profile:${userId}`, 3600, JSON.stringify(user.toObject())); } catch {}
    return res.json({ status: true, customizations: user.chatCustomizations });
  } catch (ex) { next(ex); }
};

// ─── SPRINT 1: 2FA ───────────────────────────────────────────────────────────

module.exports.setup2FA = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ status: false, msg: "User not found" });
    
    // CRITICAL FIX: Race Condition Protection
    // Prevent overwriting the 2FA secret if it's already active, which would lock the user out.
    if (user.twoFactor?.enabled) {
      return res.status(400).json({ status: false, msg: "2FA is already active. Disable it first to reconfigure." });
    }

    const secret = speakeasy.generateSecret({ name: `BestChat (${user.username})`, length: 20 });
    user.twoFactor.secret = secret.base32;
    await user.save();
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    return res.json({ status: true, qrCode: qrCodeDataUrl, secret: secret.base32 });
  } catch (ex) { next(ex); }
};

module.exports.verify2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.id);
    if (!user?.twoFactor?.secret) return res.status(400).json({ status: false, msg: "2FA not initialized." });
    const isValid = speakeasy.totp.verify({ secret: user.twoFactor.secret, encoding: "base32", token, window: 1 });
    if (!isValid) return res.status(400).json({ status: false, msg: "Invalid code. Try again." });
    const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString("hex").toUpperCase());
    user.twoFactor.enabled = true;
    user.twoFactor.backupCodes = backupCodes;
    await user.save();
    return res.json({ status: true, msg: "2FA enabled!", backupCodes });
  } catch (ex) { next(ex); }
};

module.exports.validate2FALogin = async (req, res, next) => {
  try {
    const { userId, token } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: false, msg: "User not found" });
    const backupIndex = user.twoFactor.backupCodes.indexOf(token.toUpperCase());
    if (backupIndex !== -1) {
      user.twoFactor.backupCodes.splice(backupIndex, 1);
      await user.save();
      const { accessToken, refreshToken } = generateTokens(user._id);
      const userResponse = user.toObject(); delete userResponse.password;
      return res.json({ status: true, user: userResponse, token: accessToken, refreshToken });
    }
    const isValid = speakeasy.totp.verify({ secret: user.twoFactor.secret, encoding: "base32", token, window: 1 });
    if (!isValid) return res.status(400).json({ status: false, msg: "Invalid 2FA code." });
    const { accessToken, refreshToken } = generateTokens(user._id);
    const userResponse = user.toObject(); delete userResponse.password;
    return res.json({ status: true, user: userResponse, token: accessToken, refreshToken });
  } catch (ex) { next(ex); }
};

module.exports.disable2FA = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { "twoFactor.enabled": false, "twoFactor.secret": "", "twoFactor.backupCodes": [] });
    return res.json({ status: true, msg: "2FA disabled." });
  } catch (ex) { next(ex); }
};

// ─── SPRINT 1: ARCHIVE ───────────────────────────────────────────────────────

module.exports.archiveChat = async (req, res, next) => {
  try {
    const { chatId } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ status: false, msg: "User not found" });
    const idx = user.archivedChats.findIndex((id) => id.toString() === String(chatId));
    if (idx !== -1) user.archivedChats.splice(idx, 1);
    else user.archivedChats.push(chatId);
    await user.save();
    return res.json({ status: true, archivedChats: user.archivedChats });
  } catch (ex) { next(ex); }
};

// ─── SPRINT 2: FRIEND SYSTEM ─────────────────────────────────────────────────

module.exports.sendFriendRequest = async (req, res, next) => {
  try {
    const fromId = req.user.id;
    const { toId } = req.body;
    if (String(fromId) === String(toId)) return res.status(400).json({ status: false, msg: "Cannot send a request to yourself." });
    const target = await User.findById(toId);
    if (!target) return res.status(404).json({ status: false, msg: "User not found." });
    if (target.contacts.map(String).includes(String(fromId))) return res.json({ status: false, msg: "You are already contacts." });
    const alreadyPending = target.friendRequests.some((r) => String(r.from) === String(fromId) && r.status === "pending");
    if (alreadyPending) return res.json({ status: false, msg: "Request already sent." });
    target.friendRequests.push({ from: fromId, status: "pending" });
    await target.save();
    return res.json({ status: true, msg: "Friend request sent." });
  } catch (ex) { next(ex); }
};

module.exports.respondFriendRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fromId, action } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: false, msg: "User not found." });
    const reqIdx = user.friendRequests.findIndex((r) => String(r.from) === String(fromId) && r.status === "pending");
    if (reqIdx === -1) return res.status(404).json({ status: false, msg: "Request not found." });
    user.friendRequests[reqIdx].status = action === "accept" ? "accepted" : "declined";
    if (action === "accept") {
      if (!user.contacts.map(String).includes(String(fromId))) user.contacts.push(fromId);
      await User.findByIdAndUpdate(fromId, { $addToSet: { contacts: userId } });
    }
    await user.save();
    return res.json({ status: true, msg: action === "accept" ? "Request accepted." : "Request declined." });
  } catch (ex) { next(ex); }
};

module.exports.getFriendRequests = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate("friendRequests.from", "username avatarImage statusMessage statusIcon");
    if (!user) return res.status(404).json({ status: false, msg: "User not found." });
    const pending = user.friendRequests.filter((r) => r.status === "pending");
    return res.json({ status: true, requests: pending });
  } catch (ex) { next(ex); }
};

// ─── SPRINT 2: MUTE ──────────────────────────────────────────────────────────

module.exports.muteChat = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { chatId, duration } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: false, msg: "User not found." });
    const idx = user.mutedChats.findIndex((m) => m.chatId.toString() === String(chatId));
    if (duration === null) {
      if (idx !== -1) user.mutedChats.splice(idx, 1);
    } else {
      const until = duration === 0 ? null : new Date(Date.now() + duration * 60 * 1000);
      if (idx !== -1) { user.mutedChats[idx].until = until; }
      else { user.mutedChats.push({ chatId, until }); }
    }
    await user.save();
    return res.json({ status: true, mutedChats: user.mutedChats });
  } catch (ex) { next(ex); }
};

// ─── SPRINT 2: CHAT FOLDERS ──────────────────────────────────────────────────

module.exports.saveChatFolder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { folderId, name, icon, chatIds } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: false, msg: "User not found." });
    if (folderId) {
      const idx = user.chatFolders.findIndex((f) => f._id.toString() === String(folderId));
      if (idx !== -1) {
        if (name)    user.chatFolders[idx].name    = name;
        if (icon)    user.chatFolders[idx].icon    = icon;
        if (chatIds) user.chatFolders[idx].chatIds = chatIds;
      }
    } else {
      if (user.chatFolders.length >= 10) return res.status(400).json({ status: false, msg: "Maximum 10 folders allowed." });
      user.chatFolders.push({ name: name || "New Folder", icon: icon || "📁", chatIds: chatIds || [] });
    }
    await user.save();
    return res.json({ status: true, chatFolders: user.chatFolders });
  } catch (ex) { next(ex); }
};

module.exports.deleteChatFolder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { folderId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: false, msg: "User not found." });
    user.chatFolders = user.chatFolders.filter((f) => f._id.toString() !== String(folderId));
    await user.save();
    return res.json({ status: true, chatFolders: user.chatFolders });
  } catch (ex) { next(ex); }
};

module.exports.toggleChatInFolder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { folderId, chatId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: false, msg: "User not found." });
    const folder = user.chatFolders.find((f) => f._id.toString() === String(folderId));
    if (!folder) return res.status(404).json({ status: false, msg: "Folder not found." });
    const idxInFolder = folder.chatIds.findIndex((id) => id.toString() === String(chatId));
    if (idxInFolder !== -1) folder.chatIds.splice(idxInFolder, 1);
    else folder.chatIds.push(chatId);
    await user.save();
    return res.json({ status: true, chatFolders: user.chatFolders });
  } catch (ex) { next(ex); }
};

// =============================================================================
// SPRINT 3 — ONBOARDING
// =============================================================================

// Mark onboarding tutorial as complete for this user
module.exports.completeOnboarding = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { onboardingDone: true });
    return res.json({ status: true, msg: "Onboarding complete." });
  } catch (ex) { next(ex); }
};

// =============================================================================
// SPRINT 3 — QR CODE: get current user's profile QR payload
// =============================================================================

module.exports.getProfileQRData = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("username avatarImage statusMessage _id");
    if (!user) return res.status(404).json({ status: false, msg: "User not found" });
    // The QR encodes a JSON string the scanning app can parse to open a profile
    const qrPayload = JSON.stringify({ type: "profile", userId: String(user._id), username: user.username });
    return res.json({ status: true, qrPayload, username: user.username });
  } catch (ex) { next(ex); }
};