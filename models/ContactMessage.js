const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  ipAddress: { type: String }, // optional, for tracking/rate-limit
  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ContactMessage', contactSchema);
