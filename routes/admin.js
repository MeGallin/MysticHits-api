const express = require('express');
const router = express.Router();
const { adminLimiter } = require('../middleware/rateLimiter');
const adminMiddleware = require('../middleware/adminMiddleware');
const {
  getUsers,
  deleteUser,
  changeUserRole,
  getStats,
  getMessages,
  getMessage,
  updateMessage,
  deleteMessage,
  getDailyActiveUsers,
  getTopTracks,
  getPageViewsStats,
  getUserActivitySummary,
  getDailyPageViews, // Make sure this is imported
  getTopPages, // Make sure to import the controller function
  // New listening analytics endpoints
  getListeningAnalyticsOverview,
  getUserListeningBehavior,
  getListeningPatterns,
  getGeographicListeningAnalytics,
  getPlaylistAnalytics,
  getUserEngagementAnalytics,
} = require('../controllers/adminController');
const {
  clearHitData,
  getHitAnalytics,
} = require('../controllers/seedController');
const {
  adminAddFolderToUser,
  adminRemoveFolderFromUser,
  adminGetUserFolders,
  adminBulkAddFolders,
} = require('../controllers/folderController');
const ErrorEvent = require('../models/ErrorEvent');

// Apply admin middleware to all routes
router.use(adminMiddleware);
router.use(adminLimiter);

// GET all users - protected for admins only
router.get('/users', getUsers);

// DELETE a user by ID - protected for admins only
router.delete('/users/:id', deleteUser);

// PATCH change user role - protected for admins only
router.patch('/users/:id/role', changeUserRole);

// GET system statistics - protected for admins only
router.get('/stats', getStats);

// NEW ENDPOINTS - User data aggregation
// GET daily/weekly active user counts
router.get('/stats/dau', getDailyActiveUsers);

// GET top tracks with customizable parameters
router.get('/stats/top-tracks', getTopTracks);
// Alternative route path as specified in BE-6 ticket
router.get('/top-tracks', getTopTracks);

// Contact message management routes
router.get('/messages', getMessages);
router.get('/messages/:id', getMessage);
router.patch('/messages/:id', updateMessage);
router.delete('/messages/:id', deleteMessage);

// Add new route to retrieve error logs (BE-11)
router.get('/errors', async (req, res) => {
  try {
    const { days = 7, limit = 100, page = 1 } = req.query;

    // Calculate date threshold for filtering
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    // Set up pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Query errors
    const errors = await ErrorEvent.find({ at: { $gte: daysAgo } })
      .sort({ at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalErrors = await ErrorEvent.countDocuments({
      at: { $gte: daysAgo },
    });

    res.json({
      errors,
      pagination: {
        total: totalErrors,
        page: parseInt(page),
        pages: Math.ceil(totalErrors / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve error logs' });
  }
});

router.get('/stats/pageviews', adminMiddleware, getPageViewsStats);

// GET user activity summary (new users, logins per day)
router.get(
  '/stats/user-activity-summary',
  adminMiddleware,
  getUserActivitySummary,
);

// Add this new route - alternative URL that doesn't trigger ad blockers
router.get('/metrics/daily-activity', adminMiddleware, getDailyPageViews);

// Also keep the original route in case you want to use it directly
router.get('/stats/pageviews/daily', adminMiddleware, getDailyPageViews);

// GET top pages statistics
router.get('/stats/top-pages', adminMiddleware, getTopPages);

// Replace seed endpoint with clear endpoint
router.delete('/clear/hit-data', clearHitData);

// Add real analytics endpoint
router.get('/analytics/hits', getHitAnalytics);

// NEW LISTENING ANALYTICS ENDPOINTS
// GET comprehensive listening analytics overview
router.get('/listening-analytics/overview', getListeningAnalyticsOverview);

// GET detailed user listening behavior analytics
router.get('/listening-analytics/user-behavior', getUserListeningBehavior);

// GET listening patterns analysis (time of day, frequency)
router.get('/listening-analytics/patterns', getListeningPatterns);

// GET geographic listening analytics
router.get('/listening-analytics/geographic', getGeographicListeningAnalytics);

// GET playlist usage analytics
router.get('/listening-analytics/playlists', getPlaylistAnalytics);

// GET user engagement and retention analytics
router.get('/listening-analytics/engagement', getUserEngagementAnalytics);

// ADMIN FOLDER MANAGEMENT ROUTES
// Add folder to specific user
router.post('/users/:uid/folders', adminAddFolderToUser);

// Remove folder from specific user
router.delete('/users/:uid/folders/:folderId', adminRemoveFolderFromUser);

// Get all folders for specific user
router.get('/users/:uid/folders', adminGetUserFolders);

// Bulk add folders to multiple users
router.post('/folders/bulk-add', adminBulkAddFolders);

module.exports = router;
