
# Contact Form API Setup

This document outlines how to set up a simple Contact Form API in the Node.js/Express backend, with rate limiting and MongoDB integration.

---

## 1. Data Model

**File:** `models/ContactMessage.js`

```javascript
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  fullName:    { type: String, required: true },
  email:       { type: String, required: true },
  message:     { type: String, required: true },
  ipAddress:   { type: String },               // optional, for tracking/rate-limit
  submittedAt: { type: Date,   default: Date.now }
});

module.exports = mongoose.model('ContactMessage', contactSchema);
```

---

## 2. Rate Limiting Middleware

Install the rate limiter:

```bash
npm install express-rate-limit
```

**File:** `middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,        // 1 hour window
  max: 5,                          // limit each IP to 5 submissions per window
  message: {
    error: 'Too many contact requests, please try again later.'
  }
});

module.exports = { contactLimiter };
```

---

## 3. Controller

**File:** `controllers/contactController.js`

```javascript
const ContactMessage = require('../models/ContactMessage');

exports.submitContact = async (req, res) => {
  try {
    const { fullName, email, message } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const contact = new ContactMessage({
      fullName,
      email,
      message,
      ipAddress
    });
    await contact.save();

    // Optional: send notification email here

    res.status(201).json({ success: true, message: 'Thank you—we’ll be in touch!' });
  } catch (err) {
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
};
```

---

## 4. Route Setup

**File:** `routes/contact.js`

```javascript
const express = require('express');
const router = express.Router();
const { submitContact } = require('../controllers/contactController');
const { contactLimiter } = require('../middleware/rateLimiter');

router.post('/', contactLimiter, submitContact);

module.exports = router;
```

Mount in `server.js`:

```javascript
const contactRoutes = require('./routes/contact');
app.use('/api/contact', contactRoutes);
```

---

## 5. Front-end Integration

- Create a form collecting `fullName`, `email`, and `message`.
- POST JSON to `/api/contact`.
- Handle success and error responses appropriately.

---

## 6. Optional Enhancements

- **Email Notifications:** Use `nodemailer` to send an email when a new message arrives.
- **Admin Dashboard:** Add routes to fetch and manage submissions.
- **Spam Protection:** Integrate CAPTCHA or honeypot fields.
- **Validation:** Additional server-side validation if desired.

---

This Contact Form API stores user submissions in MongoDB and prevents abuse via rate limiting.
