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

## 9. (Planned) Forgot/Reset Password

> The forgot/reset password endpoints and email logic are not yet implemented in the codebase.  
> When implemented, they will follow the pattern described in the earlier documentation.
