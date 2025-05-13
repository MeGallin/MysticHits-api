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
console.log('Rate limit whitelist:', WHITELIST);
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

module.exports = { globalLimiter, authLimiter, contactLimiter };
