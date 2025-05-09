/**
 * Migration script to create TTL indexes on event collections
 *
 * This script ensures that PlayEvent and LoginEvent collections
 * have proper TTL indexes set for auto-expiring documents after 30 days.
 */

const mongoose = require('mongoose');
require('dotenv').config();
const PlayEvent = require('../models/PlayEvent');
const LoginEvent = require('../models/LoginEvent');

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mystichits')
  .then(async () => {
    try {
      // Create TTL indexes using the createIndexes() method

      // Explicitly create the indexes (though they're defined in the schema)
      await PlayEvent.createIndexes();
      await LoginEvent.createIndexes();

      // Verify the indexes were created correctly
      const playEventIndexes = await mongoose.connection.db
        .collection('playevents')
        .indexes();
      const loginEventIndexes = await mongoose.connection.db
        .collection('loginevents')
        .indexes();
    } catch (error) {
      console.error('Error creating TTL indexes:', error);
    } finally {
      // Close the connection
      await mongoose.connection.close();
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
