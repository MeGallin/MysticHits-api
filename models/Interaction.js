const mongoose = require('mongoose');

const InteractionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'user',
  },
  trackId: {
    type: String,
    required: true,
  },
  interactionType: {
    type: String,
    required: true,
    enum: ['like', 'share', 'repeat', 'skip', 'comment'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create compound index for efficient querying
InteractionSchema.index({ userId: 1, trackId: 1, interactionType: 1 });

module.exports = mongoose.model('Interaction', InteractionSchema);
