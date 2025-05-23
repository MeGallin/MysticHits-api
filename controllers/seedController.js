const Hit = require('../models/Hit');

/**
 * @desc Clear all hit data (for testing/reset purposes)
 * @route DELETE /api/admin/clear/hit-data
 * @access Private/Admin
 */
exports.clearHitData = async (req, res) => {
  try {
    const deletedCount = await Hit.deleteMany({});

    res.status(200).json({
      success: true,
      message: `Successfully cleared ${deletedCount.deletedCount} hit records`,
      recordsDeleted: deletedCount.deletedCount,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to clear hit data',
      details: err.message,
    });
  }
};

/**
 * @desc Get hit data statistics
 * @route GET /api/admin/analytics/hits
 * @access Private/Admin
 */
exports.getHitAnalytics = async (req, res) => {
  try {
    const { days = 30, page } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    const matchCriteria = {
      lastHitAt: { $gte: daysAgo },
    };

    if (page) {
      matchCriteria.page = page;
    }

    const hitStats = await Hit.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            page: '$page',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$lastHitAt',
              },
            },
          },
          totalHits: { $sum: '$hitCount' },
          uniqueVisitors: { $addToSet: '$ip' },
          referrers: { $addToSet: '$referrer' },
        },
      },
      {
        $project: {
          page: '$_id.page',
          date: '$_id.date',
          totalHits: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
          topReferrers: { $slice: ['$referrers', 5] },
        },
      },
      { $sort: { date: -1, totalHits: -1 } },
    ]);

    const totalStats = await Hit.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalHits: { $sum: '$hitCount' },
          uniquePages: { $addToSet: '$page' },
          uniqueVisitors: { $addToSet: '$ip' },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        dailyStats: hitStats,
        summary: {
          totalHits: totalStats[0]?.totalHits || 0,
          uniquePages: totalStats[0]?.uniquePages?.length || 0,
          uniqueVisitors: totalStats[0]?.uniqueVisitors?.length || 0,
          totalRecords: totalStats[0]?.totalRecords || 0,
        },
        period: {
          days: parseInt(days),
          from: daysAgo.toISOString(),
          to: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch hit analytics',
      details: err.message,
    });
  }
};
