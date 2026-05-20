const User = require('../models/User');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class AuthService {
  generateToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  }

  async registerUser(userData) {
    try {
      const { username, email, password } = userData;
      const userExists = await User.findOne({ email });

      if (userExists) throw new Error('User already exists');

      const user = await User.create({ username, email, password });
      const token = this.generateToken(user._id);

      return { user: { _id: user._id, username: user.username, email: user.email }, token };
    } catch (error) {
      logger.error(`AuthService register error: ${error.message}`);
      throw error;
    }
  }

  async loginUser(email, password) {
    try {
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.matchPassword(password))) {
        throw new Error('Invalid email or password');
      }

      const token = this.generateToken(user._id);
      return { user: { _id: user._id, username: user.username, email: user.email }, token };
    } catch (error) {
      logger.error(`AuthService login error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AuthService();
