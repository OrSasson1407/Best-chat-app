const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
// Assume other requires are here...

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(cookieParser()); // ?? High Impact: Parses the new secure HttpOnly cookies

// ?? High Impact: /health endpoint for Render.com Keep-Alive crons (prevents sleep)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Import your routes...
// app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/messages', require('./routes/messagesRoute'));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // ?? High Impact: Pre-warm the Mongoose connection pool so the first user request is fast
    const User = require('./models/User');
    await User.findOne().lean().exec(); 
    logger.info('Database pre-warmed.');

    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Startup failed: ${error.message}`);
    process.exit(1); // We don't want this crashing our tests!
  }
};

// ?? FIX: Prevent server from auto-starting during Jest tests
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Export the app for Supertest to use
module.exports = { app, server };
