const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("DB Connection Successful");
  } catch (err) {
    logger.error(`DB Connection Error: ${err.message}`);
    process.exit(1); // Exit process with failure if DB fails to connect
  }
};

module.exports = connectDB;