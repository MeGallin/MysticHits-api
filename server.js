const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const connectDB = require('./config/db');
const {
  globalLimiter,
  authLimiter,
  contactLimiter,
} = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { trackMetrics } = require('./middleware/requestMetrics');
const hitsRoutes = require('./routes/hits');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const playlistRoutes = require('./routes/playlist');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');
const chartsRoutes = require('./routes/charts');
const folderRoutes = require('./routes/folders');

const app = express();

// Trust proxy setting for production environments to get real client IP behind proxies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Updated CORS configuration to handle both development and production URLs
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      const allowedOrigins = [
        'http://localhost:5173',
        'https://mystichits.com',
        'https://www.mystichits.com', // Added www subdomain
      ];
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow credentials (cookies, authorization headers)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());
app.use(trackMetrics); // Track request metrics for all routes

connectDB().catch((err) => {
  // Log only critical DB connection errors
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

// Apply rate limiters
app.use(globalLimiter); // Apply global rate limiter to all routes
app.use('/api/auth', authLimiter, authRoutes); // More strict limit on auth routes
app.use('/api/contact', contactLimiter, contactRoutes); // Strict limit on contact form

app.use('/api/hits', hitsRoutes);
app.use('/api/playlist', playlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/charts', chartsRoutes);
app.use('/api/user/folders', folderRoutes);

// Error handling middleware - must be after all routes
app.use(errorHandler);

const PORT = process.env.PORT || 8000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

module.exports = app;
