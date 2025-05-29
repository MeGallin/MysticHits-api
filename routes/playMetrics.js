const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getTrackMetrics,
  getUserSummary,
  getUserTopTracks,
  getTrendingTracks,
  getTrackDetails,
} = require('../controllers/playMetricsController');

/**
 * @route   GET /api/playmetrics/track/:trackId
 * @desc    Get consolidated metrics for a specific track
 * @access  Public
 */
router.get('/track/:trackId', getTrackMetrics);

/**
 * @route   GET /api/playmetrics/track/:trackId/details
 * @desc    Get detailed metrics breakdown for a track
 * @access  Public
 */
router.get('/track/:trackId/details', getTrackDetails);

/**
 * @route   GET /api/playmetrics/user/summary
 * @desc    Get user's personal play summary
 * @access  Private
 */
router.get('/user/summary', auth, getUserSummary);

/**
 * @route   GET /api/playmetrics/user/top-tracks
 * @desc    Get user's most played tracks with full metrics
 * @access  Private
 * @query   limit (default: 10, max: 50)
 * @query   timeframe (all, week, month, year)
 */
router.get('/user/top-tracks', auth, getUserTopTracks);

/**
 * @route   GET /api/playmetrics/trending
 * @desc    Get trending tracks based on recent play metrics
 * @access  Public
 * @query   limit (default: 20, max: 100)
 * @query   timeframe (day, week, month)
 */
router.get('/trending', getTrendingTracks);

module.exports = router;
