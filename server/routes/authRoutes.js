const { register, login, getAllUsers } = require("../controllers/authController");
const router = require("express").Router();

router.post("/register", register);
router.post("/login", login);

// FIX: Make sure this line is exactly like this
router.get("/allusers/:id", getAllUsers);

module.exports = router;