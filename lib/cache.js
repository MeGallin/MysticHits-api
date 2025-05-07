/**
 * Centralized cache manager for the application
 * Provides a single instance of NodeCache for use across the application
 */

const NodeCache = require('node-cache');

// Create a single cache instance with default TTL of 10 minutes (600 seconds)
const cache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120, // Check for expired keys every 2 minutes
});

module.exports = cache;