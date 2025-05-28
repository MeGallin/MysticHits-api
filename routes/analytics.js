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
 * @route   GET /api/analytics/overview
 * @desc    Get listening analytics overview
 * @access  Private (Admin only)
 */
router.get('/overview', auth, adminMiddleware, getOverview);

/**
 * @route   GET /api/analytics/user-behavior
 * @desc    Get user behavior analytics
 * @access  Private (Admin only)
 */
router.get('/user-behavior', auth, adminMiddleware, getUserBehavior);

/**
 * @route   GET /api/analytics/patterns
 * @desc    Get listening patterns analytics
 * @access  Private (Admin only)
 */
router.get('/patterns', auth, adminMiddleware, getPatterns);

/**
 * @route   GET /api/analytics/geographic
 * @desc    Get geographic analytics
 * @access  Private (Admin only)
 */
router.get('/geographic', auth, adminMiddleware, getGeographic);

/**
 * @route   GET /api/analytics/playlists
 * @desc    Get playlist analytics
 * @access  Private (Admin only)
 */
router.get('/playlists', auth, adminMiddleware, getPlaylistAnalytics);

/**
 * @route   GET /api/analytics/engagement
 * @desc    Get engagement analytics
 * @access  Private (Admin only)
 */
router.get('/engagement', auth, adminMiddleware, getEngagement);

module.exports = router;
