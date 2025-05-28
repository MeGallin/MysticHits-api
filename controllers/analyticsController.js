const PlayEvent = require('../models/PlayEvent');

/**
 * Get listening analytics overview
 * @route GET /api/analytics/overview
 */
exports.getOverview = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [overview, completion, sources, devices] = await Promise.all([
      // Basic overview stats
      PlayEvent.aggregate([
        { $match: { startedAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalPlays: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueTracks: { $addToSet: '$trackUrl' },
            totalListenTime: { $sum: '$listenDuration' },
            totalDuration: { $sum: '$duration' },
            averageSessionLength: { $avg: '$sessionPosition' }
          }
        },
        {
          $project: {
            totalPlays: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
            uniqueTracks: { $size: '$uniqueTracks' },
            totalListenTime: 1,
            listenRatio: {
              $cond: [
                { $gt: ['$totalDuration', 0] },
                { $divide: ['$totalListenTime', '$totalDuration'] },
                0
              ]
            },
            averageSessionLength: { $round: ['$averageSessionLength', 1] }
          }
        }
      ]),

      // Completion stats
      PlayEvent.aggregate([
        { $match: { startedAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalTracks: { $sum: 1 },
            completedTracks: { $sum: { $cond: ['$completed', 1, 0] } }
          }
        },
        {
          $project: {
            completionRate: {
              $cond: [
                { $gt: ['$totalTracks', 0] },
                { $divide: ['$completedTracks', '$totalTracks'] },
                0
              ]
            }
          }
        }
      ]),

      // Top sources
      PlayEvent.aggregate([
        { $match: { startedAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 },
            averageListenDuration: { $avg: '$listenDuration' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            source: '$_id',
            count: 1,
            averageListenDuration: { $round: ['$averageListenDuration', 0] }
          }
        }
      ]),

      // Top devices
      PlayEvent.aggregate([
        { $match: { startedAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$deviceType',
            count: { $sum: 1 },
            averageListenDuration: { $avg: '$listenDuration' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            deviceType: '$_id',
            count: 1,
            averageListenDuration: { $round: ['$averageListenDuration', 0] }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        overview: overview[0] || {
          totalPlays: 0,
          uniqueUsers: 0,
          uniqueTracks: 0,
          totalListenTime: 0,
          listenRatio: 0,
          averageSessionLength: 0
        },
        completion: completion[0] || { completionRate: 0 },
        sources: sources || [],
        devices: devices || []
      }
    });
  } catch (error) {
    console.error('Error fetching overview analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch overview analytics' });
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
          totalLikes: { $sum: { $cond: ['$liked', 1, 0] } }
        }
      },
      {
        $project: {
          userId: '$_id',
          totalPlays: 1,
          totalListenTime: { $round: ['$totalListenTime', 0] },
          averageCompletion: { $round: ['$averageCompletion', 2] },
          uniqueTracks: { $size: '$uniqueTracks' },
          totalLikes: 1
        }
      },
      { $sort: { totalPlays: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: {
        users: users || []
      }
    });
  } catch (error) {
    console.error('Error fetching user behavior analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user behavior analytics' });
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
            averageListenDuration: { $avg: '$listenDuration' }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            hour: '$_id',
            count: 1,
            averageListenDuration: { $round: ['$averageListenDuration', 0] }
          }
        }
      ]),

      // Genre pattern
      PlayEvent.aggregate([
        { 
          $match: { 
            startedAt: { $gte: startDate },
            genre: { $exists: true, $ne: null }
          } 
        },
        {
          $group: {
            _id: '$genre',
            count: { $sum: 1 },
            averageListenDuration: { $avg: '$listenDuration' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
        {
          $project: {
            genre: '$_id',
            count: 1,
            averageListenDuration: { $round: ['$averageListenDuration', 0] }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        hourlyPattern: hourlyPattern || [],
        genrePattern: genrePattern || []
      }
    });
  } catch (error) {
    console.error('Error fetching patterns analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch patterns analytics' });
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
            country: { $exists: true, $ne: null }
          } 
        },
        {
          $group: {
            _id: '$country',
            count: { $sum: 1 },
            averageListenDuration: { $avg: '$listenDuration' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            country: '$_id',
            count: 1,
            averageListenDuration: { $round: ['$averageListenDuration', 0] }
          }
        }
      ]),

      // Regions
      PlayEvent.aggregate([
        { 
          $match: { 
            startedAt: { $gte: startDate },
            region: { $exists: true, $ne: null }
          } 
        },
        {
          $group: {
            _id: '$region',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            region: '$_id',
            count: 1
          }
        }
      ]),

      // Cities
      PlayEvent.aggregate([
        { 
          $match: { 
            startedAt: { $gte: startDate },
            city: { $exists: true, $ne: null }
          } 
        },
        {
          $group: {
            _id: '$city',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            city: '$_id',
            count: 1
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        countries: countries || [],
        regions: regions || [],
        cities: cities || []
      }
    });
  } catch (error) {
    console.error('Error fetching geographic analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch geographic analytics' });
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
          playlistId: { $exists: true, $ne: null }
        } 
      },
      {
        $group: {
          _id: '$playlistId',
          totalPlays: { $sum: 1 },
          totalListenTime: { $sum: '$listenDuration' },
          averageCompletion: { $avg: { $cond: ['$completed', 1, 0] } },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueTracks: { $addToSet: '$trackUrl' }
        }
      },
      {
        $project: {
          playlistId: '$_id',
          totalPlays: 1,
          totalListenTime: { $round: ['$totalListenTime', 0] },
          averageCompletion: { $round: ['$averageCompletion', 2] },
          uniqueUsers: { $size: '$uniqueUsers' },
          uniqueTracks: { $size: '$uniqueTracks' }
        }
      },
      { $sort: { totalPlays: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: {
        playlists: playlists || []
      }
    });
  } catch (error) {
    console.error('Error fetching playlist analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch playlist analytics' });
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

    const engagement = await PlayEvent.aggregate([
      { $match: { startedAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: 1 },
          likesCount: { $sum: { $cond: ['$liked', 1, 0] } },
          sharesCount: { $sum: { $cond: ['$shared', 1, 0] } },
          skipsCount: { $sum: { $cond: ['$skipped', 1, 0] } },
          repeatsCount: { $sum: { $cond: ['$repeated', 1, 0] } },
          averageListenTime: { $avg: '$listenDuration' },
          averageSkipTime: { $avg: '$skipTime' }
        }
      },
      {
        $project: {
          likeRate: {
            $cond: [
              { $gt: ['$totalPlays', 0] },
              { $divide: ['$likesCount', '$totalPlays'] },
              0
            ]
          },
          shareRate: {
            $cond: [
              { $gt: ['$totalPlays', 0] },
              { $divide: ['$sharesCount', '$totalPlays'] },
              0
            ]
          },
          skipRate: {
            $cond: [
              { $gt: ['$totalPlays', 0] },
              { $divide: ['$skipsCount', '$totalPlays'] },
              0
            ]
          },
          repeatRate: {
            $cond: [
              { $gt: ['$totalPlays', 0] },
              { $divide: ['$repeatsCount', '$totalPlays'] },
              0
            ]
          },
          averageListenTime: { $round: ['$averageListenTime', 0] },
          averageSkipTime: { $round: ['$averageSkipTime', 0] }
        }
      }
    ]);

    res.json({
      success: true,
      data: engagement[0] || {
        likeRate: 0,
        shareRate: 0,
        skipRate: 0,
        repeatRate: 0,
        averageListenTime: 0,
        averageSkipTime: 0
      }
    });
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch engagement analytics' });
  }
};
