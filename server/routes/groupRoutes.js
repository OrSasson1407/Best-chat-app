const { 
    createGroup, 
    getUserGroups, 
    getGroupMessages, 
    addMember, 
    removeMember, 
    leaveGroup, 
    deleteGroup,
    createChannel,         // --- MERGE UPDATE ---
    searchPublicChannels,  // --- MERGE UPDATE ---
    joinChannel,           // --- MERGE UPDATE ---
    promoteToModerator     // --- MERGE UPDATE ---
} = require("../controllers/groupController");

const router = require("express").Router();

router.post("/create", createGroup);
router.get("/getgroups", getUserGroups); 
router.post("/getmessages", getGroupMessages);
router.post("/addmember", addMember);
router.post("/removemember", removeMember); 
router.delete("/leave/:id", leaveGroup); 
router.delete("/delete/:id", deleteGroup); 

// --- MERGE UPDATE: NEW ROUTES ---
router.post("/channel/create", createChannel);
router.get("/channel/search", searchPublicChannels);
router.post("/channel/join", joinChannel);
router.post("/promote", promoteToModerator);

module.exports = router;