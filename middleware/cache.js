const NodeCache = require('node-cache');

// Initialize cache with standard TTL of 10 minutes
const cache = new NodeCache({ stdTTL: 600 });

/**
 * Middleware to cache responses
 * @param {number} duration - Cache duration in seconds
 */
function cacheMiddleware(duration) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Use URL as cache key
    const key = req.originalUrl;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.send(cachedResponse);
    }

    // Store original send function
    const originalSend = res.send;

    // Override send function to cache the response
    res.send = function (body) {
      cache.set(key, body, duration);
      originalSend.call(this, body);
    };

    next();
  };
}

module.exports = { cacheMiddleware };
