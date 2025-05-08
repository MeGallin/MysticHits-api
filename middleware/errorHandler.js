const ErrorEvent = require('../models/ErrorEvent');
const { hashIp } = require('../utils/ipHasher');

/**
 * Global error handler middleware
 * Logs errors to the database and returns appropriate responses
 */
const errorHandler = (err, req, res, next) => {
  // Default to 500 server error
  const statusCode = err.statusCode || 500;
  
  // Get client IP and hash it
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const ipHash = hashIp(ip);
  
  // Create error event record
  const errorEvent = new ErrorEvent({
    route: req.originalUrl,
    status: statusCode,
    msg: err.message || 'An unexpected error occurred',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ipHash
  });

  // Log to database asynchronously - don't wait for it
  errorEvent.save().catch(dbErr => {
    console.error('Error saving error event to database:', dbErr);
  });
  
  // Log to console in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${req.method}] ${req.originalUrl}:`, err);
  }
  
  // Send appropriate error response
  res.status(statusCode).json({
    error: err.message || 'An unexpected error occurred',
    // Only include stack trace in development
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;