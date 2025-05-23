// rateLimiters.js
const rateLimit = require('express-rate-limit');
const ipRangeCheck = require('ip-range-check'); // tiny helper lib
const WHITELIST = process.env.RATE_LIMIT_WHITELIST
  ? process.env.RATE_LIMIT_WHITELIST.split(',').map((s) => s.trim())
  : [];

console.log('Rate limit whitelist:', WHITELIST);

function skipIfWhitelisted(req) {
  return ipRangeCheck(req.ip, WHITELIST);
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
  skip: skipIfWhitelisted, // 👈 NEW
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' },
  skip: skipIfWhitelisted, // 👈 NEW
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many contact requests, please try again later.' },
  skip: skipIfWhitelisted, // 👈 NEW
});

// Add a more generous rate limiter specifically for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 500, // Allow up to 500 requests per 10 minutes
  message: { error: 'Admin rate limit exceeded, please try again soon.' },
  skip: skipIfWhitelisted,
  // Fix: Use the standard format for standardHeaders
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = { globalLimiter, authLimiter, contactLimiter, adminLimiter };
