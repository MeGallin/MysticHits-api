const rateLimit = require('express-rate-limit');

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 submissions per window
  message: {
    error: 'Too many contact requests, please try again later.',
  },
});

module.exports = { contactLimiter };
