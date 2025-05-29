const PlayEvent = require('../models/PlayEvent');
const NodeCache = require('node-cache');

// Cache for 5 minutes to reduce database load
const cache = new NodeCache({ stdTTL: 300 });

/**
 * Get consolidated metrics for a specific track
 * GET /api/playmetrics/track/:trackId
 */
const getTrackMetrics = async (req, res) => {
  try {
    const { trackId } = req.params;
    const cacheKey = `track_metrics_${trackId}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Aggregate all metrics for this track
    const metrics = await PlayEvent.aggregate([
      { $match: { trackId } },
      {
        $group: {
          _id: '$trackId',
          totalPlays: { $sum: '$playMetrics.count' },
          totalDuration: { $sum: '$playMetrics.totalDuration' },
          totalListenTime: { $sum: '$playMetrics.totalListenTime' },
          completions: { $sum: '$playMetrics.completions' },
          skips: { $sum: '$playMetrics.skips' },
          repeats: { $sum: '$playMetrics.repeats' },
          likes: { $sum: '$playMetrics.likes' },
          shares: { $sum: '$playMetrics.shares' },
          uniqueUsers: { $addToSet: '$userId' },
          lastPlayed: { $max: '$playMetrics.lastPlayed' },
          title: { $first: '$title' },
          artist: { $first: '$artist' },
          album: { $first: '$album' },
          genre: { $first: '$genre' },
          year: { $first: '$year' },
        },
      },
      {
        $project: {
          _id: 0,
          trackId: '$_id',
          title: 1,
          artist: 1,
          album: 1,
          genre: 1,
          year: 1,
          metrics: {
            totalPlays: '$totalPlays',
            totalDuration: '$totalDuration',
            totalListenTime: '$totalListenTime',
            completions: '$completions',
            skips: '$skips',
            repeats: '$repeats',
            likes: '$likes',
            shares: '$shares',
            uniqueUsers: { $size: '$uniqueUsers' },
            lastPlayed: '$lastPlayed',
            completionRate: {
              $cond: {
                if: { $gt: ['$totalPlays', 0] },
                then: { $divide: ['$completions', '$totalPlays'] },
                else: 0,
              },
            },
            skipRate: {
              $cond: {
                if: { $gt: ['$totalPlays', 0] },
                then: { $divide: ['$skips', '$totalPlays'] },
                else: 0,
              },
            },
            avgListenTime: {
              $cond: {
                if: { $gt: ['$totalPlays', 0] },
                then: { $divide: ['$totalListenTime', '$totalPlays'] },
                else: 0,
              },
            },
          },
        },
      },
    ]);

    const result = metrics[0] || {
      trackId,
      title: null,
      artist: null,
      album: null,
      genre: null,
      year: null,
      metrics: {
        totalPlays: 0,
        totalDuration: 0,
        totalListenTime: 0,
        completions: 0,
        skips: 0,
        repeats: 0,
        likes: 0,
        shares: 0,
        uniqueUsers: 0,
        lastPlayed: null,
        completionRate: 0,
        skipRate: 0,
        avgListenTime: 0,
      },
    };

    // Cache the result
    cache.set(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('Error getting track metrics:', error);
    res.status(500).json({ message: 'Failed to get track metrics' });
  }
};

/**
 * Get user's personal play summary
 * GET /api/playmetrics/user/summary
 */
const getUserSummary = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const cacheKey = `user_summary_${userId}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get user's play summary
    const summary = await PlayEvent.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$userId',
          totalPlays: { $sum: '$playMetrics.count' },
          totalListenTime: { $sum: '$playMetrics.totalListenTime' },
          totalDuration: { $sum: '$playMetrics.totalDuration' },
          completions: { $sum: '$playMetrics.completions' },
          skips: { $sum: '$playMetrics.skips' },
          repeats: { $sum: '$playMetrics.repeats' },
          likes: { $sum: '$playMetrics.likes' },
          shares: { $sum: '$playMetrics.shares' },
          uniqueTracks: { $addToSet: '$trackId' },
          firstPlay: { $min: '$timestamp' },
          lastPlay: { $max: '$playMetrics.lastPlayed' },
        },
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          summary: {
            totalPlays: '$totalPlays',
            totalListenTime: '$totalListenTime',
            totalDuration: '$totalDuration',
            completions: '$completions',
            skips: '$skips',
            repeats: '$repeats',
            likes: '$likes',
            shares: '$shares',
            uniqueTracks: { $size: '$uniqueTracks' },
            firstPlay: '$firstPlay',
            lastPlay: '$lastPlay',
            completionRate: {
              $cond: {
                if: { $gt: ['$totalPlays', 0] },
                then: { $divide: ['$completions', '$totalPlays'] },
                else: 0,
              },
            },
            skipRate: {
              $cond: {
                if: { $gt: ['$totalPlays', 0] },
                then: { $divide: ['$skips', '$totalPlays'] },
                else: 0,
              },
            },
            avgListenTime: {
              $cond: {
                if: { $gt: ['$totalPlays', 0] },
                then: { $divide: ['$totalListenTime', '$totalPlays'] },
                else: 0,
              },
            },
          },
        },
      },
    ]);

    const result = summary[0] || {
      userId,
      summary: {
        totalPlays: 0,
        totalListenTime: 0,
        totalDuration: 0,
        completions: 0,
        skips: 0,
        repeats: 0,
        likes: 0,
        shares: 0,
        uniqueTracks: 0,
        firstPlay: null,
        lastPlay: null,
        completionRate: 0,
        skipRate: 0,
        avgListenTime: 0,
      },
    };

    // Cache the result for 2 minutes (shorter cache for user data)
    cache.set(cacheKey, result, 120);

    res.json(result);
  } catch (error) {
    console.error('Error getting user summary:', error);
    res.status(500).json({ message: 'Failed to get user summary' });
  }
};

/**
 * Get user's most played tracks with full metrics
 * GET /api/playmetrics/user/top-tracks
 */
const getUserTopTracks = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { limit = 10, timeframe = 'all' } = req.query;
    const limitNum = Math.min(parseInt(limit), 50); // Max 50 tracks

    // Calculate date filter based on timeframe
    let dateFilter = {};
    if (timeframe !== 'all') {
      const now = new Date();
      let daysAgo;
      switch (timeframe) {
        case 'week':
          daysAgo = 7;
          break;
        case 'month':
          daysAgo = 30;
          break;
        case 'year':
          daysAgo = 365;
          break;
        default:
          daysAgo = null;
      }

      if (daysAgo) {
        const startDate = new Date(
          now.getTime() - daysAgo * 24 * 60 * 60 * 1000,
        );
        dateFilter = { 'playMetrics.lastPlayed': { $gte: startDate } };
      }
    }

    const cacheKey = `user_top_tracks_${userId}_${limit}_${timeframe}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get user's top tracks
    const topTracks = await PlayEvent.aggregate([
      {
        $match: {
          userId: userId,
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: '$trackId',
          totalPlays: { $sum: '$playMetrics.count' },
          totalListenTime: { $sum: '$playMetrics.totalListenTime' },
          totalDuration: { $sum: '$playMetrics.totalDuration' },
          completions: { $sum: '$playMetrics.completions' },
          skips: { $sum: '$playMetrics.skips' },
          repeats: { $sum: '$playMetrics.repeats' },
          likes: { $sum: '$playMetrics.likes' },
          shares: { $sum: '$playMetrics.shares' },
          lastPlayed: { $max: '$playMetrics.lastPlayed' },
          title: { $first: '$title' },
          artist: { $first: '$artist' },
          album: { $first: '$album' },
          genre: { $first: '$genre' },
          year: { $first: '$year' },
          trackUrl: { $first: '$trackUrl' },
        },
      },
      {
        $project: {
          _id: 0,
          trackId: '$_id',
          title: 1,
          artist: 1,
          album: 1,
          genre: 1,
          year: 1,
          trackUrl: 1,
          metrics: {
            totalPlays: '$totalPlays',
            totalListenTime: '$totalListenTime',
            totalDuration: '$totalDuration',
            completions: '$completions',
            skips: '$skips',
            repeats: '$repeats',
            likes: '$likes',
            shares: '$shares',
            lastPlayed: '$lastPlayed',
            completionRate: {
              $cond: {
                if: { $gt: ['$totalPlays', 0] },
                then: { $divide: ['$completions', '$totalPlays'] },
                else: 0,
              },
            },
            skipRate: {
              $cond: {
                if: { $gt: ['$totalPlays', 0] },
                then: { $divide: ['$skips', '$totalPlays'] },
                else: 0,
              },
            },
            avgListenTime: {
              $cond: {
                if: { $gt: ['$totalPlays', 0] },
                then: { $divide: ['$totalListenTime', '$totalPlays'] },
                else: 0,
              },
            },
          },
        },
      },
      { $sort: { 'metrics.totalPlays': -1 } },
      { $limit: limitNum },
    ]);

    const result = {
      userId,
      timeframe,
      limit: limitNum,
      tracks: topTracks,
    };

    // Cache the result for 3 minutes
    cache.set(cacheKey, result, 180);

    res.json(result);
  } catch (error) {
    console.error('Error getting user top tracks:', error);
    res.status(500).json({ message: 'Failed to get user top tracks' });
  }
};

/**
 * Get trending tracks based on recent play metrics
 * GET /api/playmetrics/trending
 */
const getTrendingTracks = async (req, res) => {
  try {
    const { limit = 20, timeframe = 'week' } = req.query;
    const limitNum = Math.min(parseInt(limit), 100); // Max 100 tracks

    // Calculate date filter based on timeframe
    const now = new Date();
    let daysAgo;
    switch (timeframe) {
      case 'day':
        daysAgo = 1;
        break;
      case 'week':
        daysAgo = 7;
        break;
      case 'month':
        daysAgo = 30;
        break;
      default:
        daysAgo = 7; // Default to week
    }

    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const cacheKey = `trending_tracks_${limit}_${timeframe}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get trending tracks based on recent activity
    const trendingTracks = await PlayEvent.aggregate([
      {
        $match: {
          'playMetrics.lastPlayed': { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$trackId',
          recentPlays: { $sum: '$playMetrics.count' },
          recentListenTime: { $sum: '$playMetrics.totalListenTime' },
          recentCompletions: { $sum: '$playMetrics.completions' },
          recentLikes: { $sum: '$playMetrics.likes' },
          recentShares: { $sum: '$playMetrics.shares' },
          uniqueUsers: { $addToSet: '$userId' },
          lastPlayed: { $max: '$playMetrics.lastPlayed' },
          title: { $first: '$title' },
          artist: { $first: '$artist' },
          album: { $first: '$album' },
          genre: { $first: '$genre' },
          year: { $first: '$year' },
          trackUrl: { $first: '$trackUrl' },
        },
      },
      {
        $project: {
          _id: 0,
          trackId: '$_id',
          title: 1,
          artist: 1,
          album: 1,
          genre: 1,
          year: 1,
          trackUrl: 1,
          trendingMetrics: {
            recentPlays: '$recentPlays',
            recentListenTime: '$recentListenTime',
            recentCompletions: '$recentCompletions',
            recentLikes: '$recentLikes',
            recentShares: '$recentShares',
            uniqueUsers: { $size: '$uniqueUsers' },
            lastPlayed: '$lastPlayed',
            // Calculate trending score based on multiple factors
            trendingScore: {
              $add: [
                { $multiply: ['$recentPlays', 1] },
                { $multiply: ['$recentLikes', 2] },
                { $multiply: ['$recentShares', 3] },
                { $multiply: [{ $size: '$uniqueUsers' }, 1.5] },
              ],
            },
            completionRate: {
              $cond: {
                if: { $gt: ['$recentPlays', 0] },
                then: { $divide: ['$recentCompletions', '$recentPlays'] },
                else: 0,
              },
            },
          },
        },
      },
      { $sort: { 'trendingMetrics.trendingScore': -1 } },
      { $limit: limitNum },
    ]);

    const result = {
      timeframe,
      limit: limitNum,
      generatedAt: new Date(),
      tracks: trendingTracks,
    };

    // Cache the result for 10 minutes
    cache.set(cacheKey, result, 600);

    res.json(result);
  } catch (error) {
    console.error('Error getting trending tracks:', error);
    res.status(500).json({ message: 'Failed to get trending tracks' });
  }
};

/**
 * Get detailed metrics breakdown for a track
 * GET /api/playmetrics/track/:trackId/details
 */
const getTrackDetails = async (req, res) => {
  try {
    const { trackId } = req.params;
    const cacheKey = `track_details_${trackId}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get detailed breakdown including time-based analytics
    const [basicMetrics, timeBreakdown, userBreakdown] = await Promise.all([
      // Basic metrics
      PlayEvent.aggregate([
        { $match: { trackId } },
        {
          $group: {
            _id: '$trackId',
            totalPlays: { $sum: '$playMetrics.count' },
            totalDuration: { $sum: '$playMetrics.totalDuration' },
            totalListenTime: { $sum: '$playMetrics.totalListenTime' },
            completions: { $sum: '$playMetrics.completions' },
            skips: { $sum: '$playMetrics.skips' },
            repeats: { $sum: '$playMetrics.repeats' },
            likes: { $sum: '$playMetrics.likes' },
            shares: { $sum: '$playMetrics.shares' },
            uniqueUsers: { $addToSet: '$userId' },
            firstPlayed: { $min: '$timestamp' },
            lastPlayed: { $max: '$playMetrics.lastPlayed' },
            title: { $first: '$title' },
            artist: { $first: '$artist' },
            album: { $first: '$album' },
            genre: { $first: '$genre' },
            year: { $first: '$year' },
          },
        },
      ]),

      // Time-based breakdown (last 30 days)
      PlayEvent.aggregate([
        {
          $match: {
            trackId,
            'playMetrics.lastPlayed': {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$playMetrics.lastPlayed',
              },
            },
            dailyPlays: { $sum: '$playMetrics.count' },
            dailyListenTime: { $sum: '$playMetrics.totalListenTime' },
            dailyCompletions: { $sum: '$playMetrics.completions' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // User engagement breakdown
      PlayEvent.aggregate([
        { $match: { trackId } },
        {
          $group: {
            _id: '$userId',
            userPlays: { $sum: '$playMetrics.count' },
            userListenTime: { $sum: '$playMetrics.totalListenTime' },
            userLikes: { $sum: '$playMetrics.likes' },
            lastPlayed: { $max: '$playMetrics.lastPlayed' },
          },
        },
        { $sort: { userPlays: -1 } },
        { $limit: 10 }, // Top 10 users
      ]),
    ]);

    const basic = basicMetrics[0];
    if (!basic) {
      return res.status(404).json({ message: 'Track not found' });
    }

    const result = {
      trackId,
      title: basic.title,
      artist: basic.artist,
      album: basic.album,
      genre: basic.genre,
      year: basic.year,
      overview: {
        totalPlays: basic.totalPlays,
        totalDuration: basic.totalDuration,
        totalListenTime: basic.totalListenTime,
        completions: basic.completions,
        skips: basic.skips,
        repeats: basic.repeats,
        likes: basic.likes,
        shares: basic.shares,
        uniqueUsers: basic.uniqueUsers.length,
        firstPlayed: basic.firstPlayed,
        lastPlayed: basic.lastPlayed,
        completionRate:
          basic.totalPlays > 0 ? basic.completions / basic.totalPlays : 0,
        skipRate: basic.totalPlays > 0 ? basic.skips / basic.totalPlays : 0,
        avgListenTime:
          basic.totalPlays > 0 ? basic.totalListenTime / basic.totalPlays : 0,
      },
      dailyBreakdown: timeBreakdown,
      topUsers: userBreakdown.map((user) => ({
        userId: user._id,
        plays: user.userPlays,
        listenTime: user.userListenTime,
        likes: user.userLikes,
        lastPlayed: user.lastPlayed,
      })),
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300);

    res.json(result);
  } catch (error) {
    console.error('Error getting track details:', error);
    res.status(500).json({ message: 'Failed to get track details' });
  }
};

module.exports = {
  getTrackMetrics,
  getUserSummary,
  getUserTopTracks,
  getTrendingTracks,
  getTrackDetails,
};
