const { trackPageHit } = require('../scripts/trackHits');

/**
 * Middleware to track page hits automatically
 * This runs on every request to collect real analytics data
 */
const hitTrackerMiddleware = (req, res, next) => {
  // Extract hit data from request
  const hitData = {
    page: req.path,
    ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
    userAgent: req.get('User-Agent') || 'Unknown',
    referrer: req.get('Referer') || req.get('Referrer'),
    userId: req.user?.id || null, // From auth middleware if user is logged in
  };

  // Track the hit asynchronously (don't block the request)
  setImmediate(() => {
    trackPageHit(hitData);
  });

  next();
};

/**
 * Selective hit tracking middleware for specific routes only
 * Use this if you want to track only certain pages
 */
const selectiveHitTracker = (trackableRoutes = []) => {
  return (req, res, next) => {
    const shouldTrack =
      trackableRoutes.length === 0 ||
      trackableRoutes.some((route) => req.path.startsWith(route));

    if (shouldTrack) {
      hitTrackerMiddleware(req, res, next);
    } else {
      next();
    }
  };
};

module.exports = {
  hitTrackerMiddleware,
  selectiveHitTracker,
};
