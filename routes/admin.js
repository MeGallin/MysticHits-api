const express = require('express');
const router = express.Router();
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
  getPageViewsStats, // Add this line
} = require('../controllers/adminController');
const ErrorEvent = require('../models/ErrorEvent');

// Apply admin middleware to all routes
router.use(adminMiddleware);

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

module.exports = router;
