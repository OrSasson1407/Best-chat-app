const express = require("express");
const { 
  createGroup, 
  getUserGroups, 
  getGroupMessages, 
  addMember, 
  removeMember, 
  leaveGroup, 
  deleteGroup,
  promoteToModerator,
  demoteModerator,
  promoteToAdmin,
  kickMember,
  createChannel,
  searchPublicChannels,
  joinChannel
} = require("../controllers/groupController");

// --- FIXED: IMPORT AUTH MIDDLEWARE ---
const auth = require("../middleware/authMiddleware"); 

const router = express.Router();

// Basic Group Routes
router.post("/create", auth, createGroup);
router.get("/getgroups", auth, getUserGroups); // FIXED: Reverted back to /getgroups to match frontend
router.post("/messages", auth, getGroupMessages);

// Standard Member Management
router.post("/add-member", auth, addMember);
router.post("/remove-member", auth, removeMember);
router.delete("/leave/:id", auth, leaveGroup);
router.delete("/delete/:id", auth, deleteGroup);

// --- NEW: Advanced Roles & Moderation ---
router.post("/promoteToModerator", auth, promoteToModerator);
router.post("/demoteModerator", auth, demoteModerator);
router.post("/promoteToAdmin", auth, promoteToAdmin);
router.post("/kickMember", auth, kickMember);

// --- NEW: Public Channels ---
router.post("/createChannel", auth, createChannel);
router.get("/searchChannels", auth, searchPublicChannels);
router.post("/joinChannel", auth, joinChannel);

module.exports = router;