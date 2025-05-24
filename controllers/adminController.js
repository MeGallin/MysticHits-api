const User = require('../models/User');
const Hit = require('../models/Hit');
const ContactMessage = require('../models/ContactMessage');
const cache = require('../lib/cache');
const {
  getStartOfDay,
  getStartOfWeek,
  getDaysAgo,
  dayStart,
  daysAgo,
} = require('../lib/agg');
const LoginEvent = require('../models/LoginEvent');
const PlayEvent = require('../models/PlayEvent');

// Get all users with sensitive fields filtered out
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select(
      '-password -resetPasswordToken -resetPasswordExpires',
    );
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Delete a user by ID
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    // First find the user to check if they exist and if they're an admin
    const userToDelete = await User.findById(id);

    // Handle user not found
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting admin users
    if (userToDelete.isAdmin) {
      return res.status(403).json({ error: 'Admin users cannot be deleted' });
    }

    // Delete the user in a separate operation
    const result = await User.findByIdAndDelete(id);

    // Double check the deletion was successful
    if (!result) {
      throw new Error('User deletion failed');
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error in delete user operation:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Change user role (promote/demote admin status)
exports.changeUserRole = async (req, res) => {
  const { id } = req.params;
  const { isAdmin } = req.body;

  // Validate isAdmin is boolean
  if (typeof isAdmin !== 'boolean') {
    return res.status(422).json({ error: 'isAdmin boolean required' });
  }

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    // Find and update user
    const user = await User.findByIdAndUpdate(
      id,
      { isAdmin },
      {
        new: true,
        select: '-password -resetPasswordToken -resetPasswordExpires',
      },
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user,
      message: `User ${isAdmin ? 'promoted to' : 'demoted from'} admin role`,
    });
  } catch (error) {
    console.error('Error changing user role:', error);
    res.status(500).json({ error: 'Failed to change user role' });
  }
};

// Get system statistics
exports.getStats = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const hitsResult = await Hit.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$hitCount' },
        },
      },
    ]);

    const totalViews = hitsResult.length > 0 ? hitsResult[0].totalViews : 0;
    const uniqueVisitors = await Hit.countDocuments();

    return res.status(200).json({
      users: {
        total: userCount,
        admins: await User.countDocuments({ isAdmin: true }),
      },
      pageViews: {
        total: totalViews,
        uniqueVisitors: uniqueVisitors,
      },
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// Get all contact messages
exports.getMessages = async (req, res) => {
  try {
    const filter = req.query.filter; // 'all', 'unread', or 'important'

    let queryCondition = {};
    if (filter === 'unread') {
      queryCondition = { read: false };
    } else if (filter === 'important') {
      queryCondition = { important: true };
    }

    const messages = await ContactMessage.find(queryCondition)
      .sort({ submittedAt: -1 })
      .select('fullName email subject message submittedAt read important');

    // Transform to match frontend format
    const transformedMessages = messages.map((msg) => ({
      id: msg._id,
      name: msg.fullName,
      email: msg.email,
      subject: msg.subject,
      message: msg.message,
      date: msg.submittedAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
      read: msg.read,
      important: msg.important,
    }));

    return res.status(200).json(transformedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Get a single message by ID
exports.getMessage = async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid message ID format' });
  }

  try {
    const message = await ContactMessage.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Automatically mark as read when fetched individually
    if (!message.read) {
      message.read = true;
      await message.save();
    }

    const transformedMessage = {
      id: message._id,
      name: message.fullName,
      email: message.email,
      subject: message.subject,
      message: message.message,
      date: message.submittedAt.toISOString().split('T')[0],
      read: message.read,
      important: message.important,
    };

    return res.status(200).json(transformedMessage);
  } catch (error) {
    console.error('Error fetching message:', error);
    return res.status(500).json({ error: 'Failed to fetch message' });
  }
};

// Update message properties (read/important status)
exports.updateMessage = async (req, res) => {
  const { id } = req.params;
  const { read, important } = req.body;

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid message ID format' });
  }

  // Validate that at least one property to update is provided
  if (read === undefined && important === undefined) {
    return res.status(400).json({ error: 'No properties to update' });
  }

  try {
    // Build update object with only provided fields
    const updateData = {};
    if (read !== undefined) updateData.read = read;
    if (important !== undefined) updateData.important = important;

    const message = await ContactMessage.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const transformedMessage = {
      id: message._id,
      name: message.fullName,
      email: message.email,
      subject: message.subject,
      message: message.message,
      date: message.submittedAt.toISOString().split('T')[0],
      read: message.read,
      important: message.important,
    };

    return res.status(200).json({
      success: true,
      message: 'Message updated successfully',
      data: transformedMessage,
    });
  } catch (error) {
    console.error('Error updating message:', error);
    return res.status(500).json({ error: 'Failed to update message' });
  }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid message ID format' });
  }

  try {
    const result = await ContactMessage.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ error: 'Message not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
};

/**
 * Get Daily and Weekly Active Users
 * Returns count of unique users who logged in during the last day and week
 * @route GET /api/admin/stats/dau
 * @access Private (Admin only)
 */
exports.getDailyActiveUsers = async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'admin:stats:dau';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // If not cached, calculate the values
    const oneDayAgo = getDaysAgo(1);
    const sevenDaysAgo = getDaysAgo(7);

    // Get daily active users (unique users in the last 24h)
    const dauResult = await LoginEvent.aggregate([
      {
        $match: {
          at: { $gte: oneDayAgo },
        },
      },
      {
        $group: {
          _id: '$userId',
        },
      },
      {
        $count: 'count',
      },
    ]);

    // Get weekly active users (unique users in the last 7 days)
    const wauResult = await LoginEvent.aggregate([
      {
        $match: {
          at: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: '$userId',
        },
      },
      {
        $count: 'count',
      },
    ]);

    // Format the result
    const result = {
      dau: dauResult.length > 0 ? dauResult[0].count : 0,
      wau: wauResult.length > 0 ? wauResult[0].count : 0,
      updated: new Date().toISOString(),
    };

    // Cache the result for 10 minutes
    cache.set(cacheKey, result, 600); // 10 minutes in seconds

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching active user stats:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch active user statistics' });
  }
};

/**
 * Get Top Tracks
 * Returns the most played tracks in a given time window
 * @route GET /api/admin/stats/top-tracks
 * @access Private (Admin only)
 */
exports.getTopTracks = async (req, res) => {
  try {
    // Parse and validate query parameters
    const days = parseInt(req.query.days) || 7;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Cap at 50

    if (days < 1 || days > 30) {
      return res
        .status(400)
        .json({ error: 'Days parameter must be between 1 and 30' });
    }

    // Create cache key based on parameters
    const cacheKey = `admin:stats:top-tracks:${days}:${limit}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // If not cached, calculate the values
    const daysAgo = getDaysAgo(days);

    const topTracks = await PlayEvent.aggregate([
      {
        $match: {
          startedAt: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: '$trackUrl',
          count: { $sum: 1 },
          title: { $first: '$title' },
          // We're getting the first occurrence's title
          // In a more complex setup, we might want to join with a Track collection
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 0,
          trackUrl: '$_id',
          title: 1,
          count: '$count', // Keep as count to match frontend interface
        },
      },
    ]);

    // Cache the result for 30 minutes
    cache.set(cacheKey, topTracks, 1800); // 30 minutes in seconds

    return res.status(200).json(topTracks);
  } catch (error) {
    console.error('Error fetching top tracks:', error);
    return res.status(500).json({ error: 'Failed to fetch top tracks' });
  }
};

/**
 * Get Daily Active Users (DAU) and Weekly Active Users (WAU) stats
 * Implements BE-5 - Endpoint /api/admin/stats/dau
 * @route GET /api/admin/stats/dau
 * @access Private/Admin
 */
exports.getDailyActiveUsers = async (req, res) => {
  try {
    const cacheKey = 'admin:dau-stats';

    // Check if we have cached results
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    // Get one day ago and seven days ago timestamps
    const oneDayAgo = daysAgo(1);
    const sevenDaysAgo = daysAgo(7);

    // Aggregate daily active users (DAU)
    const dauResult = await LoginEvent.aggregate([
      {
        $match: {
          at: { $gte: oneDayAgo },
        },
      },
      {
        $group: {
          _id: '$userId',
          lastLogin: { $max: '$at' },
        },
      },
      {
        $count: 'dau',
      },
    ]);

    // Aggregate weekly active users (WAU)
    const wauResult = await LoginEvent.aggregate([
      {
        $match: {
          at: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: '$userId',
          lastLogin: { $max: '$at' },
        },
      },
      {
        $count: 'wau',
      },
    ]);

    // Extract values or use 0 if no results
    const dau = dauResult.length > 0 ? dauResult[0].dau : 0;
    const wau = wauResult.length > 0 ? wauResult[0].wau : 0;

    const result = {
      dau,
      wau,
      updated: new Date(),
    };

    // Cache result for 10 minutes
    cache.set(cacheKey, result, 600); // 10 minutes in seconds

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching DAU/WAU stats:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch user activity stats' });
  }
};

/**
 * @desc Get page view statistics
 * @route GET /api/admin/stats/pageviews
 * @access Private/Admin
 */
exports.getPageViewsStats = async (req, res, next) => {
  try {
    const { days } = req.query;
    const cacheKey = `pageviews_stats_${days || 'lifetime'}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    let matchStage = {};
    let period = 'lifetime';

    if (days) {
      const daysNum = parseInt(days, 10);
      if (isNaN(daysNum) || daysNum <= 0) {
        return res.status(400).json({ message: 'Invalid days parameter' });
      }
      matchStage = { lastHitAt: { $gte: getDaysAgo(daysNum) } };
      period = daysNum === 1 ? '24h' : `${daysNum}d`;
    }

    const totalHitsAgg = await Hit.aggregate([
      { $match: matchStage },
      { $group: { _id: null, total: { $sum: '$hitCount' } } },
    ]);

    const uniqueIPs = await Hit.countDocuments(matchStage);

    const pageViews = totalHitsAgg.length > 0 ? totalHitsAgg[0].total : 0;

    const response = {
      pageViews,
      uniqueIPs,
      period,
      updatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, response, 600); // Cache for 10 minutes

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get user activity summary (new users, logins per day)
 * @route GET /api/admin/stats/user-activity-summary
 * @access Private/Admin
 */
exports.getUserActivitySummary = async (req, res, next) => {
  try {
    const daysToQuery = parseInt(req.query.days) || 7; // Default to 7 days
    const cacheKey = `admin:stats:user-activity-summary:${daysToQuery}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const summaries = [];
    for (let i = 0; i < daysToQuery; i++) {
      const targetDate = daysAgo(i);
      const nextDate = daysAgo(i - 1); // End of the target day

      const newUsersCount = await User.countDocuments({
        createdAt: {
          $gte: targetDate,
          $lt: nextDate,
        },
      });

      const loginsCount = await LoginEvent.countDocuments({
        at: {
          $gte: targetDate,
          $lt: nextDate,
        },
      });

      let dateLabel = targetDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (i === 0) dateLabel = 'Today';
      else if (i === 1) dateLabel = 'Yesterday';

      summaries.push({
        dateLabel,
        date: targetDate.toISOString().split('T')[0],
        newUsers: newUsersCount,
        logins: loginsCount,
      });
    }

    cache.set(cacheKey, summaries, 60 * 15); // Cache for 15 minutes
    res.json(summaries);
  } catch (error) {
    console.error('Error fetching user activity summary:', error);
    next(error); // Pass to global error handler
  }
};

/**
 * @desc Get daily page view metrics for charting
 * @route GET /api/admin/stats/pageviews/daily
 * @access Private/Admin
 */
exports.getDailyPageViews = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = parseInt(days, 10);

    if (isNaN(daysNum) || daysNum <= 0 || daysNum > 90) {
      return res
        .status(400)
        .json({ error: 'Days parameter must be between 1 and 90' });
    }

    const cacheKey = `admin:stats:daily_pageviews:${daysNum}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Calculate start date for the query
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get all hits grouped by date
    const dailyHits = await Hit.aggregate([
      {
        $match: {
          lastHitAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$lastHitAt' },
          },
          views: { $sum: '$hitCount' },
          visitors: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Create a map to ensure we have entries for all days
    const dateMap = new Map();

    // Initialize all dates in range with zero values
    for (let i = 0; i < daysNum; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (daysNum - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      dateMap.set(dateStr, { views: 0, visitors: 0 });
    }

    // Fill with actual data where available
    dailyHits.forEach((hit) => {
      const dateStr = hit._id;
      dateMap.set(dateStr, {
        views: hit.views,
        visitors: hit.visitors,
      });
    });

    // Convert to array format expected by the frontend
    const dailyData = Array.from(dateMap, ([date, data]) => ({
      date,
      views: data.views,
      visitors: data.visitors,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const result = {
      dailyData,
      period: `${daysNum} days`,
      updatedAt: new Date().toISOString(),
    };

    // Cache the results for 30 minutes
    cache.set(cacheKey, result, 1800);

    res.json(result);
  } catch (error) {
    console.error('Error getting daily page views:', error);
    next(error);
  }
};

/**
 * @desc Get top pages by hit count
 * @route GET /api/admin/stats/top-pages
 * @access Private/Admin
 */
exports.getTopPages = async (req, res, next) => {
  try {
    const { limit = 5, days = 30 } = req.query;
    const limitNum = parseInt(limit, 10);
    const daysNum = parseInt(days, 10);

    // Create a cache key based on parameters
    const cacheKey = `admin:stats:top-pages:${limitNum}:${daysNum}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Calculate the start date based on days parameter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Aggregate hits by page URL
    const topPages = await Hit.aggregate([
      {
        $match: {
          lastHitAt: { $gte: startDate },
          page: { $ne: null }, // Filter out null page values
        },
      },
      {
        $group: {
          _id: '$page',
          views: { $sum: '$hitCount' },
          visitors: { $sum: 1 },
        },
      },
      { $sort: { views: -1 } },
      { $limit: limitNum },
      {
        $project: {
          _id: 0,
          page: '$_id',
          views: 1,
          visitors: 1,
        },
      },
    ]);

    // If no results found, provide sample data instead of empty array
    if (topPages.length === 0) {
      const samplePages = [
        { page: '/', views: 587, visitors: 325, pageName: 'Home' },
        { page: '/playlist', views: 231, visitors: 189, pageName: 'Playlist' },
        { page: '/charts', views: 145, visitors: 122, pageName: 'Charts' },
      ];

      const result = {
        pages: samplePages,
        period: `${daysNum} days`,
        total: samplePages.reduce((sum, page) => sum + page.views, 0),
        updatedAt: new Date().toISOString(),
        isSampleData: true, // Flag to indicate this is sample data
      };

      cache.set(cacheKey, result, 1800);
      return res.json(result);
    }

    // Transform page URLs to make them more readable
    const transformedPages = topPages.map((page) => {
      // Extract page name from URL
      // Handle null or undefined page values safely
      let pageName = page.page || 'Unknown';

      // Clean up page path for display
      if (pageName === '/' || pageName === '' || pageName === 'Unknown') {
        pageName = 'Home';
      } else {
        try {
          // Remove leading slash, query params, and capitalize
          pageName = pageName.replace(/^\//, '').split('?')[0].split('#')[0];

          // Replace dashes with spaces and capitalize each word
          if (pageName) {
            pageName = pageName
              .replace(/-/g, ' ')
              .split('/')
              .pop() // Get the last part of the path
              .split(' ')
              .map(
                (word) => word && word.charAt(0).toUpperCase() + word.slice(1),
              )
              .join(' ');
          }

          if (!pageName) pageName = 'Home';
        } catch (error) {
          console.error('Error formatting page name:', error);
          pageName = 'Unknown Page';
        }
      }

      return {
        ...page,
        pageName,
      };
    });

    const result = {
      pages: transformedPages,
      period: `${daysNum} days`,
      total: transformedPages.reduce((sum, page) => sum + page.views, 0),
      updatedAt: new Date().toISOString(),
    };

    // Cache the result for 30 minutes
    cache.set(cacheKey, result, 1800);

    res.json(result);
  } catch (error) {
    console.error('Error getting top pages:', error);
    // Return empty pages array instead of crashing
    res.json({
      pages: [],
      period: `${req.query.days || 30} days`,
      total: 0,
      updatedAt: new Date().toISOString(),
      error: error.message,
    });
  }
};

/**
 * Get comprehensive listening analytics for admin dashboard
 * @route GET /api/admin/listening-analytics/overview
 * @access Private/Admin
 */
exports.getListeningAnalyticsOverview = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = parseInt(days, 10);

    if (isNaN(daysNum) || daysNum <= 0 || daysNum > 90) {
      return res
        .status(400)
        .json({ error: 'Days parameter must be between 1 and 90' });
    }

    const cacheKey = `admin:listening-analytics:overview:${daysNum}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const startDate = getDaysAgo(daysNum);

    // Aggregate comprehensive listening statistics
    const [totalStats, completionStats, sourceStats, deviceStats, skipStats] =
      await Promise.all([
        // Total listening statistics
        PlayEvent.aggregate([
          { $match: { startedAt: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              totalPlays: { $sum: 1 },
              totalListenTime: { $sum: '$listenDuration' },
              totalTrackTime: { $sum: '$duration' },
              uniqueUsers: { $addToSet: '$userId' },
              uniqueTracks: { $addToSet: '$trackUrl' },
              averageSessionLength: { $avg: '$sessionPosition' },
            },
          },
        ]),

        // Track completion statistics
        PlayEvent.aggregate([
          { $match: { startedAt: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              completed: { $sum: { $cond: ['$completed', 1, 0] } },
              skipped: { $sum: { $cond: ['$skipped', 1, 0] } },
              total: { $sum: 1 },
            },
          },
        ]),

        // Source statistics
        PlayEvent.aggregate([
          { $match: { startedAt: { $gte: startDate } } },
          {
            $group: {
              _id: '$source',
              count: { $sum: 1 },
              averageListenDuration: { $avg: '$listenDuration' },
            },
          },
          { $sort: { count: -1 } },
        ]),

        // Device type statistics
        PlayEvent.aggregate([
          { $match: { startedAt: { $gte: startDate } } },
          {
            $group: {
              _id: '$deviceType',
              count: { $sum: 1 },
              averageListenDuration: { $avg: '$listenDuration' },
            },
          },
          { $sort: { count: -1 } },
        ]),

        // Skip analysis
        PlayEvent.aggregate([
          {
            $match: {
              startedAt: { $gte: startDate },
              skipped: true,
              skipTime: { $exists: true },
            },
          },
          {
            $group: {
              _id: null,
              averageSkipTime: { $avg: '$skipTime' },
              totalSkips: { $sum: 1 },
            },
          },
        ]),
      ]);

    const result = {
      overview: {
        totalPlays: totalStats[0]?.totalPlays || 0,
        totalListenTime: Math.round(totalStats[0]?.totalListenTime || 0),
        totalTrackTime: Math.round(totalStats[0]?.totalTrackTime || 0),
        uniqueUsers: totalStats[0]?.uniqueUsers?.length || 0,
        uniqueTracks: totalStats[0]?.uniqueTracks?.length || 0,
        averageSessionLength: Math.round(
          totalStats[0]?.averageSessionLength || 0,
        ),
        listenRatio:
          totalStats[0]?.totalTrackTime > 0
            ? Math.round(
                (totalStats[0].totalListenTime / totalStats[0].totalTrackTime) *
                  100,
              ) / 100
            : 0,
      },
      completion: {
        completedTracks: completionStats[0]?.completed || 0,
        skippedTracks: completionStats[0]?.skipped || 0,
        totalTracks: completionStats[0]?.total || 0,
        completionRate:
          completionStats[0]?.total > 0
            ? Math.round(
                (completionStats[0].completed / completionStats[0].total) * 100,
              ) / 100
            : 0,
        skipRate:
          completionStats[0]?.total > 0
            ? Math.round(
                (completionStats[0].skipped / completionStats[0].total) * 100,
              ) / 100
            : 0,
      },
      sources: sourceStats.map((source) => ({
        source: source._id || 'unknown',
        count: source.count,
        averageListenDuration: Math.round(source.averageListenDuration || 0),
      })),
      devices: deviceStats.map((device) => ({
        deviceType: device._id || 'unknown',
        count: device.count,
        averageListenDuration: Math.round(device.averageListenDuration || 0),
      })),
      skipAnalysis: {
        averageSkipTime: Math.round(skipStats[0]?.averageSkipTime || 0),
        totalSkips: skipStats[0]?.totalSkips || 0,
      },
      period: `${daysNum} days`,
      updatedAt: new Date().toISOString(),
    };

    // Cache for 30 minutes
    cache.set(cacheKey, result, 1800);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching listening analytics overview:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch listening analytics overview' });
  }
};

/**
 * Get detailed user listening behavior analytics
 * @route GET /api/admin/listening-analytics/user-behavior
 * @access Private/Admin
 */
exports.getUserListeningBehavior = async (req, res) => {
  try {
    const { days = 7, limit = 20 } = req.query;
    const daysNum = parseInt(days, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);

    const cacheKey = `admin:listening-analytics:user-behavior:${daysNum}:${limitNum}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const startDate = getDaysAgo(daysNum);

    // Get detailed user behavior analytics
    const userBehavior = await PlayEvent.aggregate([
      { $match: { startedAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$userId',
          totalPlays: { $sum: 1 },
          totalListenTime: { $sum: '$listenDuration' },
          uniqueTracks: { $addToSet: '$trackUrl' },
          completedTracks: { $sum: { $cond: ['$completed', 1, 0] } },
          skippedTracks: { $sum: { $cond: ['$skipped', 1, 0] } },
          repeatedTracks: { $sum: { $cond: ['$repeated', 1, 0] } },
          likedTracks: { $sum: { $cond: ['$liked', 1, 0] } },
          sharedTracks: { $sum: { $cond: ['$shared', 1, 0] } },
          averageSessionLength: { $avg: '$sessionPosition' },
          deviceTypes: { $addToSet: '$deviceType' },
          sources: { $addToSet: '$source' },
          countries: { $addToSet: '$country' },
          firstPlay: { $min: '$startedAt' },
          lastPlay: { $max: '$startedAt' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $project: {
          userId: '$_id',
          username: { $arrayElemAt: ['$user.username', 0] },
          email: { $arrayElemAt: ['$user.email', 0] },
          totalPlays: 1,
          totalListenTime: { $round: ['$totalListenTime', 0] },
          uniqueTracks: { $size: '$uniqueTracks' },
          completedTracks: 1,
          skippedTracks: 1,
          repeatedTracks: 1,
          likedTracks: 1,
          sharedTracks: 1,
          averageSessionLength: { $round: ['$averageSessionLength', 1] },
          deviceTypes: { $size: '$deviceTypes' },
          sources: { $size: '$sources' },
          countries: { $size: '$countries' },
          completionRate: {
            $cond: [
              { $gt: ['$totalPlays', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$completedTracks', '$totalPlays'] },
                      100,
                    ],
                  },
                  1,
                ],
              },
              0,
            ],
          },
          skipRate: {
            $cond: [
              { $gt: ['$totalPlays', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$skippedTracks', '$totalPlays'] },
                      100,
                    ],
                  },
                  1,
                ],
              },
              0,
            ],
          },
          averageListenTimePerTrack: {
            $cond: [
              { $gt: ['$totalPlays', 0] },
              { $round: [{ $divide: ['$totalListenTime', '$totalPlays'] }, 0] },
              0,
            ],
          },
          firstPlay: 1,
          lastPlay: 1,
        },
      },
      { $sort: { totalPlays: -1 } },
      { $limit: limitNum },
    ]);

    const result = {
      users: userBehavior,
      period: `${daysNum} days`,
      totalUsers: userBehavior.length,
      updatedAt: new Date().toISOString(),
    };

    // Cache for 15 minutes
    cache.set(cacheKey, result, 900);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching user listening behavior:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch user listening behavior' });
  }
};

/**
 * Get listening patterns analysis (time of day, frequency)
 * @route GET /api/admin/listening-analytics/patterns
 * @access Private/Admin
 */
exports.getListeningPatterns = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = parseInt(days, 10);

    const cacheKey = `admin:listening-analytics:patterns:${daysNum}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const startDate = getDaysAgo(daysNum);

    const [hourlyPattern, dailyPattern, genrePattern] = await Promise.all([
      // Hourly listening patterns
      PlayEvent.aggregate([
        { $match: { startedAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $hour: '$startedAt' },
            plays: { $sum: 1 },
            totalListenTime: { $sum: '$listenDuration' },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Daily listening patterns
      PlayEvent.aggregate([
        { $match: { startedAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dayOfWeek: '$startedAt' },
            plays: { $sum: 1 },
            totalListenTime: { $sum: '$listenDuration' },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Genre listening patterns
      PlayEvent.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate },
            genre: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$genre',
            plays: { $sum: 1 },
            totalListenTime: { $sum: '$listenDuration' },
            uniqueUsers: { $addToSet: '$userId' },
            averageCompletionRate: {
              $avg: { $cond: ['$completed', 1, 0] },
            },
          },
        },
        { $sort: { plays: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Convert day numbers to day names
    const dayNames = [
      '',
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    const result = {
      hourlyPattern: Array.from({ length: 24 }, (_, hour) => {
        const data = hourlyPattern.find((p) => p._id === hour);
        return {
          hour,
          plays: data?.plays || 0,
          totalListenTime: Math.round(data?.totalListenTime || 0),
          uniqueUsers: data?.uniqueUsers?.length || 0,
        };
      }),
      dailyPattern: Array.from({ length: 7 }, (_, dayIndex) => {
        const dayNum = dayIndex === 0 ? 7 : dayIndex; // MongoDB dayOfWeek: 1=Sunday, 7=Saturday
        const data = dailyPattern.find(
          (p) => p._id === (dayIndex === 6 ? 7 : dayIndex + 1),
        );
        return {
          day: dayNames[dayIndex === 6 ? 7 : dayIndex + 1],
          dayNumber: dayIndex,
          plays: data?.plays || 0,
          totalListenTime: Math.round(data?.totalListenTime || 0),
          uniqueUsers: data?.uniqueUsers?.length || 0,
        };
      }),
      genrePattern: genrePattern.map((genre) => ({
        genre: genre._id,
        plays: genre.plays,
        totalListenTime: Math.round(genre.totalListenTime),
        uniqueUsers: genre.uniqueUsers.length,
        averageCompletionRate:
          Math.round(genre.averageCompletionRate * 100) / 100,
      })),
      period: `${daysNum} days`,
      updatedAt: new Date().toISOString(),
    };

    // Cache for 30 minutes
    cache.set(cacheKey, result, 1800);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching listening patterns:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch listening patterns' });
  }
};

/**
 * Get geographic listening analytics
 * @route GET /api/admin/listening-analytics/geographic
 * @access Private/Admin
 */
exports.getGeographicListeningAnalytics = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = parseInt(days, 10);

    const cacheKey = `admin:listening-analytics:geographic:${daysNum}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const startDate = getDaysAgo(daysNum);

    const [countryStats, regionStats, cityStats] = await Promise.all([
      // Country-level analytics
      PlayEvent.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate },
            country: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$country',
            plays: { $sum: 1 },
            totalListenTime: { $sum: '$listenDuration' },
            uniqueUsers: { $addToSet: '$userId' },
            averageSessionLength: { $avg: '$sessionPosition' },
          },
        },
        { $sort: { plays: -1 } },
        { $limit: 20 },
      ]),

      // Region-level analytics
      PlayEvent.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate },
            region: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: { country: '$country', region: '$region' },
            plays: { $sum: 1 },
            totalListenTime: { $sum: '$listenDuration' },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        { $sort: { plays: -1 } },
        { $limit: 15 },
      ]),

      // City-level analytics
      PlayEvent.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate },
            city: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: { country: '$country', region: '$region', city: '$city' },
            plays: { $sum: 1 },
            totalListenTime: { $sum: '$listenDuration' },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        { $sort: { plays: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const result = {
      countries: countryStats.map((country) => ({
        country: country._id,
        plays: country.plays,
        totalListenTime: Math.round(country.totalListenTime),
        uniqueUsers: country.uniqueUsers.length,
        averageSessionLength:
          Math.round(country.averageSessionLength * 10) / 10,
      })),
      regions: regionStats.map((region) => ({
        country: region._id.country,
        region: region._id.region,
        plays: region.plays,
        totalListenTime: Math.round(region.totalListenTime),
        uniqueUsers: region.uniqueUsers.length,
      })),
      cities: cityStats.map((city) => ({
        country: city._id.country,
        region: city._id.region,
        city: city._id.city,
        plays: city.plays,
        totalListenTime: Math.round(city.totalListenTime),
        uniqueUsers: city.uniqueUsers.length,
      })),
      period: `${daysNum} days`,
      updatedAt: new Date().toISOString(),
    };

    // Cache for 30 minutes
    cache.set(cacheKey, result, 1800);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching geographic listening analytics:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch geographic listening analytics' });
  }
};

/**
 * Get playlist usage analytics
 * @route GET /api/admin/listening-analytics/playlists
 * @access Private/Admin
 */
exports.getPlaylistAnalytics = async (req, res) => {
  try {
    const { days = 7, limit = 20 } = req.query;
    const daysNum = parseInt(days, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);

    const cacheKey = `admin:listening-analytics:playlists:${daysNum}:${limitNum}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const startDate = getDaysAgo(daysNum);

    const [playlistStats, sourceBreakdown] = await Promise.all([
      // Playlist-specific analytics
      PlayEvent.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate },
            source: 'playlist',
            playlistId: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$playlistId',
            plays: { $sum: 1 },
            totalListenTime: { $sum: '$listenDuration' },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueTracks: { $addToSet: '$trackUrl' },
            averageSessionPosition: { $avg: '$sessionPosition' },
            completedTracks: { $sum: { $cond: ['$completed', 1, 0] } },
            skippedTracks: { $sum: { $cond: ['$skipped', 1, 0] } },
          },
        },
        {
          $project: {
            playlistId: '$_id',
            plays: 1,
            totalListenTime: { $round: ['$totalListenTime', 0] },
            uniqueUsers: { $size: '$uniqueUsers' },
            uniqueTracks: { $size: '$uniqueTracks' },
            averageSessionPosition: { $round: ['$averageSessionPosition', 1] },
            completedTracks: 1,
            skippedTracks: 1,
            completionRate: {
              $cond: [
                { $gt: ['$plays', 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ['$completedTracks', '$plays'] },
                        100,
                      ],
                    },
                    1,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { plays: -1 } },
        { $limit: limitNum },
      ]),

      // Source breakdown for context
      PlayEvent.aggregate([
        { $match: { startedAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$source',
            plays: { $sum: 1 },
            totalListenTime: { $sum: '$listenDuration' },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        { $sort: { plays: -1 } },
      ]),
    ]);

    const result = {
      playlists: playlistStats,
      sourceBreakdown: sourceBreakdown.map((source) => ({
        source: source._id || 'unknown',
        plays: source.plays,
        totalListenTime: Math.round(source.totalListenTime),
        uniqueUsers: source.uniqueUsers.length,
      })),
      period: `${daysNum} days`,
      updatedAt: new Date().toISOString(),
    };

    // Cache for 20 minutes
    cache.set(cacheKey, result, 1200);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching playlist analytics:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch playlist analytics' });
  }
};

/**
 * Get user engagement and retention analytics
 * @route GET /api/admin/listening-analytics/engagement
 * @access Private/Admin
 */
exports.getUserEngagementAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = parseInt(days, 10);

    const cacheKey = `admin:listening-analytics:engagement:${daysNum}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const startDate = getDaysAgo(daysNum);

    const [engagementMetrics, retentionAnalysis, qualityMetrics] =
      await Promise.all([
        // User engagement metrics
        PlayEvent.aggregate([
          { $match: { startedAt: { $gte: startDate } } },
          {
            $group: {
              _id: '$userId',
              totalPlays: { $sum: 1 },
              totalListenTime: { $sum: '$listenDuration' },
              likedTracks: { $sum: { $cond: ['$liked', 1, 0] } },
              sharedTracks: { $sum: { $cond: ['$shared', 1, 0] } },
              repeatedTracks: { $sum: { $cond: ['$repeated', 1, 0] } },
              activeDays: {
                $addToSet: {
                  $dateToString: { format: '%Y-%m-%d', date: '$startedAt' },
                },
              },
            },
          },
          {
            $group: {
              _id: null,
              totalUsers: { $sum: 1 },
              averagePlaysPerUser: { $avg: '$totalPlays' },
              averageListenTimePerUser: { $avg: '$totalListenTime' },
              totalLikes: { $sum: '$likedTracks' },
              totalShares: { $sum: '$sharedTracks' },
              totalRepeats: { $sum: '$repeatedTracks' },
              averageActiveDays: { $avg: { $size: '$activeDays' } },
              highEngagementUsers: {
                $sum: {
                  $cond: [{ $gte: ['$totalPlays', 50] }, 1, 0],
                },
              },
            },
          },
        ]),

        // User retention analysis (users active in different time periods)
        PlayEvent.aggregate([
          { $match: { startedAt: { $gte: getDaysAgo(30) } } },
          {
            $group: {
              _id: '$userId',
              firstPlay: { $min: '$startedAt' },
              lastPlay: { $max: '$startedAt' },
              totalPlays: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: null,
              newUsersLast7Days: {
                $sum: {
                  $cond: [{ $gte: ['$firstPlay', getDaysAgo(7)] }, 1, 0],
                },
              },
              activeUsersLast7Days: {
                $sum: {
                  $cond: [{ $gte: ['$lastPlay', getDaysAgo(7)] }, 1, 0],
                },
              },
              returningUsers: {
                $sum: {
                  $cond: [{ $gt: ['$totalPlays', 1] }, 1, 0],
                },
              },
              totalUsers: { $sum: 1 },
            },
          },
        ]),

        // Quality and technical metrics
        PlayEvent.aggregate([
          { $match: { startedAt: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              totalPlays: { $sum: 1 },
              totalBufferEvents: { $sum: '$bufferCount' },
              totalQualityDrops: { $sum: '$qualityDrops' },
              networkTypes: { $addToSet: '$networkType' },
              averageBufferCount: { $avg: '$bufferCount' },
              averageQualityDrops: { $avg: '$qualityDrops' },
            },
          },
        ]),
      ]);

    const engagement = engagementMetrics[0] || {};
    const retention = retentionAnalysis[0] || {};
    const quality = qualityMetrics[0] || {};

    const result = {
      engagement: {
        totalUsers: engagement.totalUsers || 0,
        averagePlaysPerUser: Math.round(engagement.averagePlaysPerUser || 0),
        averageListenTimePerUser: Math.round(
          engagement.averageListenTimePerUser || 0,
        ),
        totalInteractions:
          (engagement.totalLikes || 0) +
          (engagement.totalShares || 0) +
          (engagement.totalRepeats || 0),
        likeRate:
          engagement.totalUsers > 0
            ? Math.round(
                (engagement.totalLikes / engagement.totalUsers) * 100,
              ) / 100
            : 0,
        shareRate:
          engagement.totalUsers > 0
            ? Math.round(
                (engagement.totalShares / engagement.totalUsers) * 100,
              ) / 100
            : 0,
        repeatRate:
          engagement.totalUsers > 0
            ? Math.round(
                (engagement.totalRepeats / engagement.totalUsers) * 100,
              ) / 100
            : 0,
        averageActiveDays:
          Math.round(engagement.averageActiveDays * 10) / 10 || 0,
        highEngagementUsers: engagement.highEngagementUsers || 0,
        highEngagementRate:
          engagement.totalUsers > 0
            ? Math.round(
                (engagement.highEngagementUsers / engagement.totalUsers) * 100,
              ) / 100
            : 0,
      },
      retention: {
        totalUsers: retention.totalUsers || 0,
        newUsersLast7Days: retention.newUsersLast7Days || 0,
        activeUsersLast7Days: retention.activeUsersLast7Days || 0,
        returningUsers: retention.returningUsers || 0,
        retentionRate:
          retention.totalUsers > 0
            ? Math.round(
                (retention.returningUsers / retention.totalUsers) * 100,
              ) / 100
            : 0,
        newUserRetentionRate:
          retention.newUsersLast7Days > 0
            ? Math.round(
                (retention.activeUsersLast7Days / retention.newUsersLast7Days) *
                  100,
              ) / 100
            : 0,
      },
      quality: {
        totalPlays: quality.totalPlays || 0,
        totalBufferEvents: quality.totalBufferEvents || 0,
        totalQualityDrops: quality.totalQualityDrops || 0,
        averageBufferCount:
          Math.round(quality.averageBufferCount * 100) / 100 || 0,
        averageQualityDrops:
          Math.round(quality.averageQualityDrops * 100) / 100 || 0,
        bufferRate:
          quality.totalPlays > 0
            ? Math.round(
                (quality.totalBufferEvents / quality.totalPlays) * 100,
              ) / 100
            : 0,
        qualityIssueRate:
          quality.totalPlays > 0
            ? Math.round(
                (quality.totalQualityDrops / quality.totalPlays) * 100,
              ) / 100
            : 0,
      },
      period: `${daysNum} days`,
      updatedAt: new Date().toISOString(),
    };

    // Cache for 45 minutes
    cache.set(cacheKey, result, 2700);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching user engagement analytics:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch user engagement analytics' });
  }
};
