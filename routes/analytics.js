const express = require('express');
const router = express.Router();
const {
  getOverview,
  getUserBehavior,
  getPatterns,
  getGeographic,
  getPlaylistAnalytics,
  getEngagement,
} = require('../controllers/analyticsController');
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/adminMiddleware');

/**
 * @route   GET /api/analytics/listening-overview
 * @desc    Get listening analytics overview
 * @access  Private (Admin only)
 */
router.get('/listening-overview', auth, adminMiddleware, getOverview);

/**
 * @route   GET /api/analytics/user-listening-behavior
 * @desc    Get user behavior analytics
 * @access  Private (Admin only)
 */
router.get('/user-listening-behavior', auth, adminMiddleware, getUserBehavior);

/**
 * @route   GET /api/analytics/listening-patterns
 * @desc    Get listening patterns analytics
 * @access  Private (Admin only)
 */
router.get('/listening-patterns', auth, adminMiddleware, getPatterns);

/**
 * @route   GET /api/analytics/geographic-listening
 * @desc    Get geographic analytics
 * @access  Private (Admin only)
 */
router.get('/geographic-listening', auth, adminMiddleware, getGeographic);

/**
 * @route   GET /api/analytics/playlist-analytics
 * @desc    Get playlist analytics
 * @access  Private (Admin only)
 */
router.get('/playlist-analytics', auth, adminMiddleware, getPlaylistAnalytics);

/**
 * @route   GET /api/analytics/user-engagement
 * @desc    Get engagement analytics
 * @access  Private (Admin only)
 */
router.get('/user-engagement', auth, adminMiddleware, getEngagement);

module.exports = router;
