# Authentication Setup for Mystic Hits API

This document outlines the JWT-based authentication flow, including signup, login, and route protection, running on port 8000.

---

## 1. Environment Variables

Create a `.env` file at the project root:

```env
MONGO_URI=mongodb://localhost:27017/mystichits
PORT=8000
JWT_SECRET=your_jwt_secret_here
RESET_TOKEN_EXPIRES=3600000   # 1 hour in milliseconds
```

---

## 2. User Model

**File: `models/User.js`**

```javascript
const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
});

// Instance method to create a password reset token
userSchema.methods.createPasswordReset = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  const expiresIn = process.env.RESET_TOKEN_EXPIRES
    ? parseInt(process.env.RESET_TOKEN_EXPIRES, 10)
    : 60 * 60 * 1000; // 1 hour in ms
  this.resetPasswordExpires = Date.now() + expiresIn;
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
```

---

## 3. Auth Controller

**File: `controllers/authController.js`**

```javascript
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const JWT_EXPIRES_IN = '7d';

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use.' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });
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
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    res.json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
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

module.exports = router;
```

---

## 5. JWT Middleware

**File: `middleware/auth.js`**

```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
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

## 7. Protected Views Endpoint

**File: `routes/views.js`**

```javascript
const express = require('express');
const router = express.Router();
const viewsController = require('../controllers/viewsController');
const auth = require('../middleware/auth');

router.get('/register-view', auth, viewsController.registerView);

module.exports = router;
```

**Usage:**  
To access `/api/views/register-view`, you must include a valid JWT in the Authorization header:

```
GET http://localhost:8000/api/views/register-view
Authorization: Bearer <your-jwt-token>
```

---

## 8. Testing Endpoints

1. **Signup**  
   `POST http://localhost:8000/api/auth/signup`  
   Body:

   ```json
   {
     "username": "alice",
     "email": "alice@example.com",
     "password": "secret123"
   }
   ```

2. **Login**  
   `POST http://localhost:8000/api/auth/login`  
   Body:

   ```json
   { "email": "alice@example.com", "password": "secret123" }
   ```

3. **Protected Route Example**  
   `GET http://localhost:8000/api/views/register-view`  
   Header:
   ```
   Authorization: Bearer <token>
   ```

---

## 9. Password Reset Flow

### 9.1 Environment Variables

Add the following email configuration to your `.env` file:

```env
# Email Configuration
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=user@example.com
EMAIL_PASS=your_email_password
EMAIL_FROM=noreply@mystichits.com
```

### 9.2 Email Sender Utility

**File: `utils/emailSender.js`**

```javascript
const nodemailer = require('nodemailer');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'false',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email using the configured transporter
 */
const sendEmail = async (options) => {
  const { to, subject, text, html, from, bcc } = options;

  const mailOptions = {
    from: from || process.env.EMAIL_FROM || 'noreply@mystichits.com',
    to,
    subject,
    text,
    bcc: bcc || process.env.MAILER_BCC,
  };

  if (html) {
    mailOptions.html = html;
  }

  return await transporter.sendMail(mailOptions);
};

/**
 * Send a password reset email
 */
const sendPasswordResetEmail = async ({ email, resetUrl }) => {
  const subject = 'Mystichits - Password Reset Request';

  const message = `
    Hello from Mystichits!
    
    You requested a password reset. Please click the link below to reset your password:
    
    ${resetUrl}
    
    If you didn't request this, please ignore this email.
    
    Thanks,
    The Mystichits Team
  `;

  return await sendEmail({
    to: email,
    subject,
    text: message,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
};
```

### 9.3 Forgot Password Endpoint

**File: `controllers/authController.js`**

```javascript
const { sendPasswordResetEmail } = require('../utils/emailSender');

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

    // Send password reset email
    await sendPasswordResetEmail({
      email: user.email,
      resetUrl,
    });

    res.status(200).json({ message: 'Reset email sent' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
};
```

**File: `routes/auth.js`**

```javascript
router.post('/forgot-password', authController.forgotPassword);
```

### 9.4 Reset Password Endpoint

**File: `controllers/authController.js`**

```javascript
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Validate input
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token and unexpired reset token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user's password and clear reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
```

**File: `routes/auth.js`**

```javascript
router.post('/reset-password/:token', authController.resetPassword);
```

### 9.5 Usage

#### Request Forgot Password:

`POST http://localhost:8000/api/auth/forgot-password`  
Body:

```json
{
  "email": "alice@example.com"
}
```

**Response:**

```json
{
  "message": "Reset email sent"
}
```

The user will receive an email with a link to reset their password. The link will contain a unique token that expires after the time specified in `RESET_TOKEN_EXPIRES` (default: 1 hour).

#### Reset Password:

`POST http://localhost:8000/api/auth/reset-password/:token`  
Body:

```json
{
  "password": "newSecurePassword123"
}
```

**Response:**

```json
{
  "message": "Password has been reset successfully"
}
```

If the token is invalid or expired, the response will be:

```json
{
  "error": "Invalid or expired token"
}
```
