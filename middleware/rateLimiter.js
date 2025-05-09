const rateLimit = require('express-rate-limit');

// Global rate limiter - 100 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests',
  },
});

// More strict rate limiter for sensitive endpoints like login/signup
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // limit each IP to 10 login attempts per hour
  message: {
    error: 'Too many login attempts, please try again later.',
  },
});

// Contact form rate limiter
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 submissions per window
  message: {
    error: 'Too many contact requests, please try again later.',
  },
});

module.exports = { globalLimiter, authLimiter, contactLimiter };
