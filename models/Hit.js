const mongoose = require('mongoose');

const hitSchema = new mongoose.Schema({
  // Page being tracked
  page: {
    type: String,
    required: true,
    index: true,
  },
  // User information
  ip: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    default: null,
  },
  referrer: {
    type: String,
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Hit metrics
  hitCount: {
    type: Number,
    default: 1,
  },
  // Timestamps
  firstHitAt: {
    type: Date,
    default: Date.now,
  },
  lastHitAt: {
    type: Date,
    default: Date.now,
  },
});

// Create compound index on IP + page for faster lookups
hitSchema.index({ ip: 1, page: 1 });

module.exports = mongoose.model('Hit', hitSchema);
