const User = require("../models/User");
const bcrypt = require("bcryptjs");

// 1. Register Logic
module.exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if username is already taken
    const usernameCheck = await User.findOne({ username });
    if (usernameCheck)
      return res.json({ msg: "Username already used", status: false });

    // Check if email is already taken
    const emailCheck = await User.findOne({ email });
    if (emailCheck)
      return res.json({ msg: "Email already used", status: false });

    // Encrypt the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user in the database
    const user = await User.create({
      email,
      username,
      password: hashedPassword,
    });

    // Convert to simple object and remove password before sending back
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({ status: true, user: userResponse });
  } catch (ex) {
    next(ex);
  }
};

// 2. Login Logic
module.exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Find user by username
    const user = await User.findOne({ username });
    if (!user)
      return res.json({ msg: "Incorrect Username or Password", status: false });

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.json({ msg: "Incorrect Username or Password", status: false });

    // Remove password before sending back
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({ status: true, user: userResponse });
  } catch (ex) {
    next(ex);
  }
};

// 3. Get All Users (Contacts List)
module.exports.getAllUsers = async (req, res, next) => {
  try {
    // Select all users EXCEPT the one requesting (req.params.id)
    // We only need their id, username, email, and avatar
    const users = await User.find({ _id: { $ne: req.params.id } }).select([
      "email",
      "username",
      "avatar",
      "_id",
    ]);
    return res.json(users);
  } catch (ex) {
    next(ex);
  }
};