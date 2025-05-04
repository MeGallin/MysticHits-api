const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, default: 'No Subject' },
  message: { type: String, required: true },
  ipAddress: { type: String }, // optional, for tracking/rate-limit
  submittedAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  important: { type: Boolean, default: false }
});

module.exports = mongoose.model('ContactMessage', contactSchema);
