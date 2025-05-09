const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  trackUrl: { type: String, required: true },
  title: { type: String },
  duration: { type: Number }, // seconds
  completed: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
});

// Add TTL index (30 days = 2592000 seconds)
playSchema.index({ startedAt: 1 }, { expireAfterSeconds: 2592000 });

// Add compound index for better performance on date range queries
playSchema.index({ startedAt: 1, userId: 1 });
// Add compound index for top tracks aggregation
playSchema.index({ startedAt: 1, trackUrl: 1 });
// Add userId and startedAt index for BE-4 spec
playSchema.index({ userId: 1, startedAt: 1 });

module.exports = mongoose.model('PlayEvent', playSchema);
