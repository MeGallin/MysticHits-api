const mongoose = require('mongoose');

const hitSchema = new mongoose.Schema({
  ipHash: {
    type: String,
    required: true,
    unique: true,
    length: 64, // SHA-256 hex string length
  },
  hitCount: {
    type: Number,
    default: 1,
  },
  lastHitAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Hit', hitSchema);
