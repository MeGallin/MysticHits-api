const Hit = require('../models/Hit');

/**
 * Track a page hit in real-time
 */
const trackPageHit = async (hitData) => {
  try {
    const { page, ip, userAgent, referrer, userId } = hitData;
    const now = new Date();

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const existingHit = await Hit.findOne({
      page,
      ip,
      lastHitAt: { $gte: oneHourAgo },
    });

    if (existingHit) {
      existingHit.hitCount += 1;
      existingHit.lastHitAt = now;
      if (userId && !existingHit.userId) {
        existingHit.userId = userId;
      }
      await existingHit.save();
    } else {
      await Hit.create({
        page,
        ip,
        userAgent,
        referrer: referrer || null,
        userId: userId || null,
        hitCount: 1,
        firstHitAt: now,
        lastHitAt: now,
      });
    }
  } catch (error) {
    // Don't throw error to avoid breaking the main request
  }
};

/**
 * Get real-time hit statistics
 */
const getHitStatistics = async (options = {}) => {
  try {
    const { days = 7, page } = options;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const matchCriteria = {
      lastHitAt: { $gte: daysAgo },
    };

    if (page) {
      matchCriteria.page = page;
    }

    const topPages = await Hit.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$page',
          totalHits: { $sum: '$hitCount' },
          uniqueVisitors: { $addToSet: '$ip' },
        },
      },
      {
        $project: {
          page: '$_id',
          totalHits: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
        },
      },
      { $sort: { totalHits: -1 } },
      { $limit: 10 },
    ]);

    const dailyStats = await Hit.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$lastHitAt',
            },
          },
          totalHits: { $sum: '$hitCount' },
          uniqueVisitors: { $addToSet: '$ip' },
          pages: { $addToSet: '$page' },
        },
      },
      {
        $project: {
          date: '$_id',
          totalHits: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
          uniquePages: { $size: '$pages' },
        },
      },
      { $sort: { date: -1 } },
    ]);

    return {
      topPages,
      dailyStats,
      period: {
        days,
        from: daysAgo.toISOString(),
        to: new Date().toISOString(),
      },
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  trackPageHit,
  getHitStatistics,
};
