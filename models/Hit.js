const mongoose = require('mongoose');

const hitSchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    unique: true,
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
