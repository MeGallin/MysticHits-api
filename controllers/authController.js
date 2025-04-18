const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const JWT_EXPIRES_IN = '7d';

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'false', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset token
    const resetToken = user.createPasswordReset();
    await user.save();

    // Construct reset URL
    const resetUrl = `${req.protocol}://${req.get(
      'host',
    )}/api/auth/reset-password/${resetToken}`;

    // Create email content
    const message = `
      Hello from Mystichits!
      
      You requested a password reset. Please click the link below to reset your password:
      
      ${resetUrl}
      
      If you didn't request this, please ignore this email.
      
      Thanks,
      The Mystichits Team
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@mystichits.com',
      to: user.email,
      bcc: process.env.MAILER_BCC,
      subject: 'Mystichits - Password Reset Request',
      text: message,
    });

    res.status(200).json({ message: 'Reset email sent' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Failed to send reset email' });
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
