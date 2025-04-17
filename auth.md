
# Authentication Setup for Mystic Hits API

This document outlines the JWT-based authentication flow, including signup, login, forgot password, and reset password, running on port 8000.

---

## 1. Environment Variables

Create a `.env` file at the project root:

```env
MONGO_URI=mongodb://localhost:27017/mystichits
PORT=8000
JWT_SECRET=your_jwt_secret_here
EMAIL_HOST=smtp.your-email.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASS=your-email-password
RESET_TOKEN_EXPIRES=3600000   # 1 hour in milliseconds
```

---

## 2. User Model

**File: `models/User.js`**

```javascript
const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username:   { type: String, required: true },
  email:      { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  createdAt:  { type: Date,   default: Date.now },
  resetPasswordToken:   String,
  resetPasswordExpires: Date,
});

// Generate password reset token
userSchema.methods.createPasswordReset = function() {
  const buf = crypto.randomBytes(20);
  const token = buf.toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.resetPasswordExpires = Date.now() + parseInt(process.env.RESET_TOKEN_EXPIRES);
  return token;
};

module.exports = mongoose.model('User', userSchema);
```

---

## 3. Auth Controller

**File: `controllers/authController.js`**

```javascript
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Signup
exports.signup = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password: hash });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account with that email' });

    const resetToken = user.createPasswordReset();
    await user.save();

    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
    await transporter.sendMail({
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Password Reset',
      text: `Click to reset your password:

${resetUrl}`
    });

    res.json({ message: 'Reset email sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

---

## 4. Auth Routes

**File: `routes/auth.js`**

```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;
```

---

## 5. JWT Middleware

**File: `middleware/auth.js`**

```javascript
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Authentication failed!' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
```

---

## 6. Integrate in `server.js`

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const viewsRoutes = require('./routes/views');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/views', viewsRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
```

---

## 7. Testing Endpoints

1. **Signup**  
   `POST http://localhost:8000/api/auth/signup`  
   Body:  
   ```json
   { "username":"alice", "email":"alice@example.com", "password":"secret123" }
   ```

2. **Login**  
   `POST http://localhost:8000/api/auth/login`  
   Body:  
   ```json
   { "email":"alice@example.com", "password":"secret123" }
   ```

3. **Forgot Password**  
   `POST http://localhost:8000/api/auth/forgot-password`  
   Body:  
   ```json
   { "email":"alice@example.com" }
   ```

4. **Reset Password**  
   `POST http://localhost:8000/api/auth/reset-password/<token>`  
   Body:  
   ```json
   { "password":"newSecret123" }
   ```

5. **Protected Route**  
   Include header:  
   ```
   Authorization: Bearer <token>
   ```
