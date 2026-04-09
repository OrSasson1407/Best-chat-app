const express = require("express");
const {
  createGroup, getUserGroups, getGroupById, getGroupMessages,
  addMember, removeMember, leaveGroup, deleteGroup,
  promoteToModerator, demoteModerator, promoteToAdmin, kickMember,
  createChannel, searchPublicChannels, joinChannel,
  // Sprint 3
  setGroupRules, setMaxMembers,
  getInviteCode, joinViaInviteCode,
} = require("../controllers/groupController");

const auth = require("../middleware/authMiddleware");
const router = express.Router();

// ── Core group routes ─────────────────────────────────────────────────────────
router.post("/create",       auth, createGroup);
router.get("/getgroups",     auth, getUserGroups);
router.post("/messages",     auth, getGroupMessages);
router.post("/getmessages",  auth, getGroupMessages);

// ── Member management ─────────────────────────────────────────────────────────
router.post("/add-member",    auth, addMember);
router.post("/remove-member", auth, removeMember);
router.delete("/leave/:id",   auth, leaveGroup);
router.delete("/delete/:id",  auth, deleteGroup);

// ── Roles & moderation ────────────────────────────────────────────────────────
router.post("/promoteToModerator", auth, promoteToModerator);
router.post("/demoteModerator",    auth, demoteModerator);
router.post("/promoteToAdmin",     auth, promoteToAdmin);
router.post("/kickMember",         auth, kickMember);

// ── Public channels ───────────────────────────────────────────────────────────
router.post("/createChannel",    auth, createChannel);
router.get("/searchChannels",    auth, searchPublicChannels);
router.post("/joinChannel",      auth, joinChannel);

// ── Sprint 3: Group rules ─────────────────────────────────────────────────────
router.post("/set-rules",        auth, setGroupRules);

// ── Sprint 3: Max member limit ────────────────────────────────────────────────
router.post("/set-max-members",  auth, setMaxMembers);

// ── Sprint 3: QR invite code ──────────────────────────────────────────────────
router.get("/invite-code/:groupId", auth, getInviteCode);
router.post("/join-via-code",       auth, joinViaInviteCode);

// ── Single group fetch (must be last to avoid shadowing named GET routes) ─────
router.get("/:id",           auth, getGroupById);

module.exports = router;