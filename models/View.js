const mongoose = require('mongoose');

const viewSchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    unique: true,
  },
  viewCount: {
    type: Number,
    default: 1,
  },
  lastViewedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('View', viewSchema);
