const PlayEvent = require('../models/PlayEvent');
const NodeCache = require('node-cache');

// Cache analytics results to reduce database load
const analyticsCache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes

// Add cache object at the top of the file after imports
const cache = {};

/**
 * Get listening analytics overview
 * @route GET /api/analytics/overview
 */
exports.getOverview = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    // Check cache first
    const cacheKey = `analytics_overview_${days}`;
    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // First query aggregated events
    const aggregatedResults = await PlayEvent.aggregate([
      {
        $match: {
          isAggregated: true,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: '$playMetrics.count' },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueTracks: { $addToSet: '$trackId' },
          totalListenTime: { $sum: '$playMetrics.totalListenTime' },
          totalDuration: { $sum: '$playMetrics.totalDuration' },
          completions: { $sum: '$playMetrics.completions' },
          skips: { $sum: '$playMetrics.skips' },
        },
      },
    ]);

    // Then query individual events (only if needed)
    const individualResults = await PlayEvent.aggregate([
      {
        $match: {
          isAggregated: { $ne: true },
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueTracks: { $addToSet: '$trackId' },
          totalListenTime: { $sum: '$listenDuration' },
          totalDuration: { $sum: '$duration' },
          completions: { $sum: { $cond: ['$completed', 1, 0] } },
          skips: { $sum: { $cond: ['$skipped', 1, 0] } },
        },
      },
    ]);

    // Merge/prepare metrics
    const aggregated = aggregatedResults[0] || {
      totalPlays: 0,
      uniqueUsers: [],
      uniqueTracks: [],
      totalListenTime: 0,
      totalDuration: 0,
      completions: 0,
      skips: 0,
    };

    const individual = individualResults[0] || {
      totalPlays: 0,
      uniqueUsers: [],
      uniqueTracks: [],
      totalListenTime: 0,
      totalDuration: 0,
      completions: 0,
      skips: 0,
    };

    // Merge unique arrays
    const uniqueUsers = [
      ...new Set([...aggregated.uniqueUsers, ...individual.uniqueUsers]),
    ];
    const uniqueTracks = [
      ...new Set([...aggregated.uniqueTracks, ...individual.uniqueTracks]),
    ];

    // Calculate combined metrics
    const totalPlays = aggregated.totalPlays + individual.totalPlays;
    const totalListenTime =
      aggregated.totalListenTime + individual.totalListenTime;
    const totalDuration = aggregated.totalDuration + individual.totalDuration;
    const totalCompletions = aggregated.completions + individual.completions;
    const totalTracks = totalPlays;

    // --- Add sources aggregation ---
    const sourcesAgg = await PlayEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          source: { $exists: true, $ne: null, $ne: '' },
        },
      },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          averageListenDuration: { $avg: '$listenDuration' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          source: '$_id',
          count: 1,
          averageListenDuration: { $ifNull: ['$averageListenDuration', 0] },
        },
      },
    ]);

    // --- Add devices aggregation ---
    const devicesAgg = await PlayEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          deviceType: { $exists: true, $ne: null, $ne: '' },
        },
      },
      {
        $group: {
          _id: '$deviceType',
          count: { $sum: 1 },
          averageListenDuration: { $avg: '$listenDuration' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          deviceType: '$_id',
          count: 1,
          averageListenDuration: { $ifNull: ['$averageListenDuration', 0] },
        },
      },
    ]);

    // Prepare response
    const response = {
      success: true,
      data: {
        overview: {
          totalPlays,
          uniqueUsers: uniqueUsers.length,
          uniqueTracks: uniqueTracks.length,
          totalListenTime,
          listenRatio: totalDuration > 0 ? totalListenTime / totalDuration : 0,
          averageSessionLength: 0, // Compute if you have session data
        },
        completion: {
          completionRate: totalTracks > 0 ? totalCompletions / totalTracks : 0,
        },
        sources: sourcesAgg || [],
        devices: devicesAgg || [],
      },
    };

    // Cache the response
    analyticsCache.set(cacheKey, response);

    return res.json(response);
  } catch (error) {
    console.error('Error fetching overview analytics:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch overview analytics' });
  }
};

/**
 * Get user behavior analytics
 * @route GET /api/analytics/user-behavior
 */
exports.getUserBehavior = async (req, res) => {
  try {
    const { days = 7, limit = 20 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const users = await PlayEvent.aggregate([
      { $match: { startedAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$userId',
          totalPlays: { $sum: 1 },
          totalListenTime: { $sum: '$listenDuration' },
          averageCompletion: { $avg: { $cond: ['$completed', 1, 0] } },
          uniqueTracks: { $addToSet: '$trackUrl' },
          totalLikes: { $sum: { $cond: ['$liked', 1, 0] } },
        },
      },
      {
        $project: {
          userId: '$_id',
          totalPlays: 1,
          totalListenTime: { $round: ['$totalListenTime', 0] },
          averageCompletion: { $round: ['$averageCompletion', 2] },
          uniqueTracks: { $size: '$uniqueTracks' },
          totalLikes: 1,
        },
      },
      { $sort: { totalPlays: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      success: true,
      data: {
        users: users || [],
      },
    });
  } catch (error) {
    console.error('Error fetching user behavior analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user behavior analytics',
    });
  }
};

/**
 * Get listening patterns analytics
 * @route GET /api/analytics/patterns
 */
exports.getPatterns = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [hourlyPattern, genrePattern] = await Promise.all([
      // Hourly listening pattern
      PlayEvent.aggregate([
        { $match: { startedAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $hour: '$startedAt' },
            count: { $sum: 1 },
            averageListenDuration: { $avg: '$listenDuration' },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            hour: '$_id',
            count: 1,
            averageListenDuration: { $round: ['$averageListenDuration', 0] },
          },
        },
      ]),

      // Genre pattern
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
            count: { $sum: 1 },
            averageListenDuration: { $avg: '$listenDuration' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
        {
          $project: {
            genre: '$_id',
            count: 1,
            averageListenDuration: { $round: ['$averageListenDuration', 0] },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        hourlyPattern: hourlyPattern || [],
        genrePattern: genrePattern || [],
      },
    });
  } catch (error) {
    console.error('Error fetching patterns analytics:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch patterns analytics' });
  }
};

/**
 * Get geographic analytics
 * @route GET /api/analytics/geographic
 */
exports.getGeographic = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [countries, regions, cities] = await Promise.all([
      // Countries
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
            count: { $sum: 1 },
            averageListenDuration: { $avg: '$listenDuration' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            country: '$_id',
            count: 1,
            averageListenDuration: { $round: ['$averageListenDuration', 0] },
          },
        },
      ]),

      // Regions
      PlayEvent.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate },
            region: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$region',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            region: '$_id',
            count: 1,
          },
        },
      ]),

      // Cities
      PlayEvent.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate },
            city: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$city',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            city: '$_id',
            count: 1,
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        countries: countries || [],
        regions: regions || [],
        cities: cities || [],
      },
    });
  } catch (error) {
    console.error('Error fetching geographic analytics:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch geographic analytics' });
  }
};

/**
 * Get playlist analytics
 * @route GET /api/analytics/playlists
 */
exports.getPlaylistAnalytics = async (req, res) => {
  try {
    const { days = 7, limit = 15 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const playlists = await PlayEvent.aggregate([
      {
        $match: {
          startedAt: { $gte: startDate },
          playlistId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$playlistId',
          totalPlays: { $sum: 1 },
          totalListenTime: { $sum: '$listenDuration' },
          averageCompletion: { $avg: { $cond: ['$completed', 1, 0] } },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueTracks: { $addToSet: '$trackUrl' },
        },
      },
      {
        $project: {
          playlistId: '$_id',
          totalPlays: 1,
          totalListenTime: { $round: ['$totalListenTime', 0] },
          averageCompletion: { $round: ['$averageCompletion', 2] },
          uniqueUsers: { $size: '$uniqueUsers' },
          uniqueTracks: { $size: '$uniqueTracks' },
        },
      },
      { $sort: { totalPlays: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      success: true,
      data: {
        playlists: playlists || [],
      },
    });
  } catch (error) {
    console.error('Error fetching playlist analytics:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch playlist analytics' });
  }
};

/**
 * Get engagement analytics
 * @route GET /api/analytics/engagement
 */
exports.getEngagement = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Check if PlayEvent model is available
    if (!PlayEvent) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service unavailable - missing models',
      });
    }

    // Add basic caching with ETag support
    const cacheKey = `engagement_${days}`;
    const etag = req.headers['if-none-match'];

    // Check if we can return a 304 Not Modified
    if (etag && cache[cacheKey]?.etag === etag) {
      return res.status(304).end();
    }

    // Run our query
    const engagement = await getEngagementData(startDate);

    // Generate a simple ETag for caching
    const newEtag = `W/"${Date.now().toString(36)}"`;

    // Cache the result
    cache[cacheKey] = {
      data: engagement,
      etag: newEtag,
      timestamp: Date.now(),
    };

    // Set cache headers
    res.setHeader('ETag', newEtag);
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 min cache

    res.json({
      success: true,
      data: engagement,
    });
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch engagement analytics' });
  }
};

/**
 * Helper function to get engagement data
 */
async function getEngagementData(startDate) {
  // Add appropriate fallback data for development/testing
  if (process.env.NODE_ENV === 'development' && !PlayEvent) {
    return getMockEngagementData();
  }

  // Default implementation tries to get data from PlayEvent model
  try {
    const engagement = await PlayEvent.aggregate([
      { $match: { startedAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$userId',
          totalPlays: { $sum: 1 },
          totalListenTime: { $sum: '$listenDuration' },
          averageCompletion: { $avg: { $cond: ['$completed', 1, 0] } },
          likeRate: { $avg: { $cond: ['$liked', 1, 0] } },
          shareRate: { $avg: { $cond: ['$shared', 1, 0] } },
          repeatRate: { $avg: { $cond: ['$repeated', 1, 0] } },
          activeDays: { $addToSet: { $dayOfYear: '$startedAt' } },
        },
      },
      {
        $project: {
          userId: '$_id',
          totalPlays: 1,
          totalListenTime: { $round: ['$totalListenTime', 0] },
          averageCompletion: { $round: ['$averageCompletion', 2] },
          likeRate: { $round: ['$likeRate', 2] },
          shareRate: { $round: ['$shareRate', 2] },
          repeatRate: { $round: ['$repeatRate', 2] },
          averageActiveDays: { $avg: { $size: '$activeDays' } },
        },
      },
      { $sort: { totalPlays: -1 } },
      { $limit: 100 },
    ]);

    // Calculate overall metrics
    const totalUsers = engagement.length;
    const highEngagementUsers = engagement.filter(
      (u) => u.totalPlays > 10,
    ).length;
    const highEngagementRate =
      totalUsers > 0 ? highEngagementUsers / totalUsers : 0;
    const averagePlaysPerUser =
      totalUsers > 0
        ? engagement.reduce((sum, u) => sum + u.totalPlays, 0) / totalUsers
        : 0;
    const averageListenTimePerUser =
      totalUsers > 0
        ? engagement.reduce((sum, u) => sum + u.totalListenTime, 0) / totalUsers
        : 0;

    return {
      engagement: {
        totalUsers,
        highEngagementUsers,
        highEngagementRate,
        averagePlaysPerUser,
        averageListenTimePerUser,
        likeRate:
          engagement.length > 0
            ? engagement.reduce((sum, u) => sum + u.likeRate, 0) /
              engagement.length
            : 0,
        shareRate:
          engagement.length > 0
            ? engagement.reduce((sum, u) => sum + u.shareRate, 0) /
              engagement.length
            : 0,
        repeatRate:
          engagement.length > 0
            ? engagement.reduce((sum, u) => sum + u.repeatRate, 0) /
              engagement.length
            : 0,
        averageActiveDays:
          engagement.length > 0
            ? engagement.reduce((sum, u) => sum + u.averageActiveDays, 0) /
              engagement.length
            : 0,
      },
      retention: {
        retentionRate: 0, // Placeholder, calculate if we have user session data
        newUsersLast7Days: 0, // Placeholder
        activeUsersLast7Days: 0, // Placeholder
        returningUsers: 0, // Placeholder
        newUserRetentionRate: 0, // Placeholder
      },
      quality: {
        bufferRate: 0, // Placeholder, calculate if we have buffer event data
        qualityIssueRate: 0, // Placeholder, calculate if we have quality issue data
        totalBufferEvents: 0, // Placeholder
        totalQualityDrops: 0, // Placeholder
        averageBufferCount: 0, // Placeholder
      },
    };
  } catch (err) {
    console.error('Error in getEngagementData:', err);
    throw err;
  }
}

/**
 * Generate mock data for development
 */
function getMockEngagementData() {
  return {
    engagement: {
      totalUsers: 125,
      highEngagementUsers: 35,
      highEngagementRate: 0.28,
      averagePlaysPerUser: 12.4,
      averageListenTimePerUser: 1840,
      likeRate: 0.18,
      shareRate: 0.05,
      repeatRate: 0.12,
      averageActiveDays: 4.3,
    },
    retention: {
      retentionRate: 0.68,
      newUsersLast7Days: 28,
      activeUsersLast7Days: 98,
      returningUsers: 67,
      newUserRetentionRate: 0.42,
    },
    quality: {
      bufferRate: 0.08,
      qualityIssueRate: 0.12,
      totalBufferEvents: 84,
      totalQualityDrops: 36,
      averageBufferCount: 0.7,
    },
  };
}
