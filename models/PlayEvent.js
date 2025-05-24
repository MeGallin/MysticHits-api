const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  trackUrl: { type: String, required: true },
  title: { type: String },
  duration: { type: Number }, // total track duration in seconds
  listenDuration: { type: Number, default: 0 }, // actual listen time in seconds
  completed: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }, // when the track was stopped/ended

  // Enhanced analytics fields
  artist: { type: String }, // track artist
  album: { type: String }, // track album
  genre: { type: String }, // track genre
  year: { type: Number }, // release year

  // Playback context
  source: {
    type: String,
    enum: [
      'playlist',
      'search',
      'recommendation',
      'repeat',
      'shuffle',
      'direct',
    ],
    default: 'direct',
  },
  playlistId: { type: String }, // if played from a playlist
  previousTrack: { type: String }, // URL of previous track in session
  nextTrack: { type: String }, // URL of next track in session

  // User interaction data
  skipped: { type: Boolean, default: false }, // track was skipped before completion
  skipTime: { type: Number }, // time when track was skipped (seconds from start)
  repeated: { type: Boolean, default: false }, // track was repeated/replayed
  liked: { type: Boolean }, // user liked the track during this session
  shared: { type: Boolean, default: false }, // track was shared

  // Technical data
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'smart-tv', 'speaker', 'unknown'],
    default: 'unknown',
  },
  userAgent: { type: String }, // browser/app info
  ipAddress: { type: String }, // for geographic analytics (anonymized)
  country: { type: String }, // derived from IP
  region: { type: String }, // state/province
  city: { type: String }, // city name

  // Session data
  sessionId: { type: String }, // unique session identifier
  sessionPosition: { type: Number, default: 1 }, // track position in listening session

  // Quality metrics
  bufferCount: { type: Number, default: 0 }, // number of buffer events
  qualityDrops: { type: Number, default: 0 }, // audio quality drops
  networkType: {
    type: String,
    enum: ['wifi', '4g', '3g', '2g', 'ethernet', 'unknown'],
    default: 'unknown',
  },
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
