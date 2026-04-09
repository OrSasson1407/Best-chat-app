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

// FIX: Removed the auth middleware import and usage since it is already 
// applied to the entire '/api/groups' path in server/index.js.
const router = express.Router();

// ── Core group routes ─────────────────────────────────────────────────────────
router.post("/create",       createGroup);
router.get("/getgroups",     getUserGroups);
router.post("/messages",     getGroupMessages);
router.post("/getmessages",  getGroupMessages);

// ── Member management ─────────────────────────────────────────────────────────
router.post("/add-member",    addMember);
router.post("/remove-member", removeMember);
router.delete("/leave/:id",   leaveGroup);
router.delete("/delete/:id",  deleteGroup);

// ── Roles & moderation ────────────────────────────────────────────────────────
router.post("/promoteToModerator", promoteToModerator);
router.post("/demoteModerator",    demoteModerator);
router.post("/promoteToAdmin",     promoteToAdmin);
router.post("/kickMember",         kickMember);

// ── Public channels ───────────────────────────────────────────────────────────
router.post("/createChannel",    createChannel);
router.get("/searchChannels",    searchPublicChannels);
router.post("/joinChannel",      joinChannel);

// ── Sprint 3: Group rules ─────────────────────────────────────────────────────
router.post("/set-rules",        setGroupRules);

// ── Sprint 3: Max member limit ────────────────────────────────────────────────
router.post("/set-max-members",  setMaxMembers);

// ── Sprint 3: QR invite code ──────────────────────────────────────────────────
router.get("/invite-code/:groupId", getInviteCode);
router.post("/join-via-code",       joinViaInviteCode);

// ── Single group fetch (must be last to avoid shadowing named GET routes) ─────
router.get("/:id",           getGroupById);

module.exports = router;