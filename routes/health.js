const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const adminMiddleware = require('../middleware/adminMiddleware');
const auth = require('../middleware/auth');
const { getMetrics } = require('../middleware/requestMetrics');

// Public health check endpoint
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

// Protect the health endpoint with admin middleware
router.get('/', adminMiddleware, async (req, res) => {
  const start = Date.now();
  let dbOK = false,
    latency = null;

  try {
    await mongoose.connection.db.admin().ping();
    dbOK = true;
    latency = Date.now() - start;
  } catch {
    /* DB error */
  }

  res.json({
    status: 'ok',
    uptimeSec: Math.floor(process.uptime()),
    memoryMB: +(process.memoryUsage().rss / 1024 / 1024).toFixed(1),
    db: { connected: dbOK, latencyMs: latency },
    timestamp: new Date().toISOString(),
  });
});

// Protected metrics endpoint - admins only
router.get('/metrics', auth, adminMiddleware, getMetrics);

module.exports = router;
