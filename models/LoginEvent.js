const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const loginSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ip: { type: String },
  at: { type: Date, default: Date.now },
});

// Add TTL index (30 days = 2592000 seconds)
loginSchema.index({ at: 1 }, { expireAfterSeconds: 2592000 });

// Add compound index for better performance on date range queries
loginSchema.index({ at: 1, userId: 1 });

module.exports = mongoose.model('LoginEvent', loginSchema);
