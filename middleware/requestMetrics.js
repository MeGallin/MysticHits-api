/**
 * Request metrics middleware
 * Measures API request latency and keeps track of overall metrics
 */

// Initialize metrics object to store API performance data
const metrics = {
  requestCount: 0,
  totalDuration: 0,
  averageLatency: 0,
  routes: {}, // Will store metrics by route path
};

/**
 * Reset metrics - useful for testing or scheduled resets
 */
const resetMetrics = () => {
  metrics.requestCount = 0;
  metrics.totalDuration = 0;
  metrics.averageLatency = 0;
  metrics.routes = {};
};

/**
 * Middleware to track request latency and other metrics
 */
const trackMetrics = (req, res, next) => {
  // Record start time
  const start = Date.now();
  
  // Mark original URL for tracking
  const path = req.originalUrl || req.url;
  
  // Once response is finished, calculate and store metrics
  res.on('finish', () => {
    // Calculate request duration
    const duration = Date.now() - start;
    
    // Update global metrics
    metrics.requestCount++;
    metrics.totalDuration += duration;
    metrics.averageLatency = metrics.totalDuration / metrics.requestCount;
    
    // Track metrics by route
    if (!metrics.routes[path]) {
      metrics.routes[path] = {
        requestCount: 0,
        totalDuration: 0,
        averageLatency: 0,
        statusCodes: {},
      };
    }
    
    // Update route-specific metrics
    const routeMetrics = metrics.routes[path];
    routeMetrics.requestCount++;
    routeMetrics.totalDuration += duration;
    routeMetrics.averageLatency = routeMetrics.totalDuration / routeMetrics.requestCount;
    
    // Track status code distribution
    const statusCode = res.statusCode.toString();
    if (!routeMetrics.statusCodes[statusCode]) {
      routeMetrics.statusCodes[statusCode] = 0;
    }
    routeMetrics.statusCodes[statusCode]++;
  });
  
  next();
};

/**
 * Endpoint handler to get current metrics
 */
const getMetrics = (req, res) => {
  res.json({
    uptime: process.uptime(),
    timestamp: Date.now(),
    metrics: {
      requestCount: metrics.requestCount,
      averageLatency: metrics.averageLatency.toFixed(2),
      routes: Object.entries(metrics.routes).map(([route, data]) => ({
        route,
        requestCount: data.requestCount,
        averageLatency: data.averageLatency.toFixed(2),
        statusCodes: data.statusCodes,
      })),
    },
  });
};

module.exports = { trackMetrics, getMetrics, resetMetrics };