const { register, login, getAllUsers, updateProfile } = require("../controllers/authController");
const router = require("express").Router();

router.post("/register", register);
router.post("/login", login);

// FIX: Make sure this line is exactly like this
router.get("/allusers/:id", getAllUsers);

// NEW: Profile Update Route
router.post("/updateprofile/:id", updateProfile);

module.exports = router;