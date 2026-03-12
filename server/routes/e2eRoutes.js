const router = require("express").Router();
const { uploadKeyBundle, getKeyBundle, uploadMorePreKeys } = require("../controllers/e2eController");

// Protected by JWT
router.post("/upload-bundle", uploadKeyBundle);
router.post("/upload-prekeys", uploadMorePreKeys);
router.get("/bundle/:targetUserId", getKeyBundle);

module.exports = router;