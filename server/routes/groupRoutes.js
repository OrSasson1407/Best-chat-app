const { createGroup, getUserGroups, getGroupMessages, addMember, removeMember, deleteGroup } = require("../controllers/groupController");
const router = require("express").Router();

router.post("/create", createGroup);
router.get("/getgroups/:id", getUserGroups);
router.post("/getmessages", getGroupMessages);
router.post("/addmember", addMember);
router.post("/removemember", removeMember); // Admin only
router.delete("/delete/:id", deleteGroup); // Admin only

module.exports = router;