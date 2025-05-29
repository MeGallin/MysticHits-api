const express = require('express');
const router = express.Router();
const {
  getPlaylist,
  logPlay,
  updatePlayEvent,
  batchUpdatePlayEvents,
  logInteraction,
  getUserLikes,
} = require('../controllers/playlistController');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { cacheMiddleware } = require('../middleware/cache');

// Whitelist of IP addresses that should not be rate limited
const whitelist = ['86.15.22.239', '164.215.17.118', '::1'];

// Create a rate limiter to prevent excessive database writes
const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => whitelist.includes(req.ip),
});

// Create a more permissive limiter for read operations
const readRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => whitelist.includes(req.ip),
});

/**
 * @route   GET /api/playlist
 * @desc    Get playlist from remote URL or local folder
 * @access  Public
 */
router.get('/', readRateLimiter, cacheMiddleware(300), getPlaylist);

/**
 * @route   POST /api/playlist/plays
 * @desc    Log a track play event with enhanced analytics
 * @access  Private (requires authentication)
 * @note    Use batch-update for multiple events instead of calling this repeatedly
 */
router.post('/plays', auth, writeRateLimiter, logPlay);

/**
 * @route   PUT /api/playlist/plays/:playEventId
 * @desc    Update a play event with progress/completion data
 * @access  Private (requires authentication)
 * @note    Use batch-update for multiple updates instead of calling this repeatedly
 */
router.put('/plays/:playEventId', auth, writeRateLimiter, updatePlayEvent);

/**
 * @route   POST /api/playlist/plays/batch-update
 * @desc    Batch update multiple play events - preferred method for multiple updates
 * @access  Private (requires authentication)
 */
router.post(
  '/plays/batch-update',
  auth,
  writeRateLimiter,
  batchUpdatePlayEvents,
);

/**
 * @route   POST /api/playlist/interactions
 * @desc    Log user interactions (like, share, repeat)
 * @access  Private (requires authentication)
 */
router.post('/interactions', auth, logInteraction);

/**
 * @route   GET /api/playlist/likes
 * @desc    Get user's liked tracks
 * @access  Private (requires authentication)
 */
router.get('/likes', auth, readRateLimiter, getUserLikes);

module.exports = router;
