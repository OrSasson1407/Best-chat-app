const { 
    createGroup, 
    getUserGroups, 
    getGroupMessages, 
    addMember, 
    removeMember, 
    leaveGroup, // --- NEW
    deleteGroup 
} = require("../controllers/groupController");

const router = require("express").Router();

router.post("/create", createGroup);
// Removed /:id because we use req.user.id securely from the auth middleware now
router.get("/getgroups", getUserGroups); 
router.post("/getmessages", getGroupMessages);
router.post("/addmember", addMember);
router.post("/removemember", removeMember); 
router.delete("/leave/:id", leaveGroup); // --- NEW
router.delete("/delete/:id", deleteGroup); 

module.exports = router;