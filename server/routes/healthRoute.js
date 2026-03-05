const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

/**
 * @swagger
 * /health:
 * get:
 * summary: Deep system health check for load balancers
 * tags: [System]
 * responses:
 * 200:
 * description: All systems operational
 * 503:
 * description: Service unavailable (DB or Cache down)
 */
router.get("/", async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: Date.now(),
    services: {
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    }
  };

  try {
    if (healthCheck.services.database !== "connected") {
      throw new Error("Database disconnected");
    }
    res.status(200).send(healthCheck);
  } catch (error) {
    healthCheck.message = error.message;
    res.status(503).send(healthCheck);
  }
});

module.exports = router;