const express = require('express');
const router = express.Router();
const {
  submitContact,
  getContactMessages,
} = require('../controllers/contactController');
const { contactLimiter } = require('../middleware/rateLimiter');
const auth = require('../middleware/auth'); // For admin routes

// Public route with rate limiting
router.post('/', contactLimiter, submitContact);

// Admin route to get all contact messages (protected by JWT auth)
router.get('/', auth, getContactMessages);

module.exports = router;
