const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const errorEventSchema = new Schema({
  route: { type: String, required: true },
  status: { type: Number, required: true },
  msg: { type: String, required: true },
  at: { type: Date, default: Date.now },
  stack: { type: String },
  method: { type: String },
  userAgent: { type: String },
  ipHash: { type: String, length: 64 } // Store hashed IP for privacy
});

// Add TTL index (7 days = 604800 seconds)
errorEventSchema.index({ at: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('ErrorEvent', errorEventSchema);