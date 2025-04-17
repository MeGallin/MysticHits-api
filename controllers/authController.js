const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const JWT_EXPIRES_IN = '7d';

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    // Check for existing user
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use.' });
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    // Create user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });
    // Generate JWT
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    res.status(201).json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    // Generate JWT
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    res.json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};
