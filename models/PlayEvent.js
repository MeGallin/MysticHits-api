const mongoose = require('mongoose');
const NodeCache = require('node-cache');

// In-memory cache to prevent duplicate entries in short time periods
// This will hold keys of recent play events to avoid duplicates
const playCache = new NodeCache({ stdTTL: 10 }); // Cache entries for 10 seconds by default

const PlayEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: function () {
        return !this.anonymous; // Only required if not anonymous
      },
    },
    anonymous: {
      type: Boolean,
      default: false,
    },
    trackId: {
      type: String,
      required: true,
      trim: true,
    },
    trackUrl: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },

    // Consolidated metrics to reduce database entries
    playMetrics: {
      count: { type: Number, default: 1 }, // Number of plays in this document
      totalDuration: { type: Number, default: 0 }, // Total duration of all plays
      totalListenTime: { type: Number, default: 0 }, // Total time spent listening
      lastPlayed: { type: Date, default: Date.now }, // Last time the track was played
      completions: { type: Number, default: 0 }, // Number of complete listens
      skips: { type: Number, default: 0 }, // Number of skips
      repeats: { type: Number, default: 0 }, // Number of repeats
      likes: { type: Number, default: 0 }, // Number of likes
      shares: { type: Number, default: 0 }, // Number of shares
    },

    // For individual play analytics (optional, set storeDetailedMetrics to false to disable)
    duration: Number,
    listenDuration: Number,
    completed: Boolean,
    skipped: Boolean,
    skipTime: Number,
    repeated: Boolean,
    liked: Boolean,
    shared: Boolean,

    // Enhanced analytics fields
    artist: String,
    album: String,
    genre: String,
    year: Number,

    // Playback context
    source: String,
    playlistId: String,
    previousTrack: String,
    nextTrack: String,

    // Technical data
    deviceType: String,
    userAgent: String,
    ipAddress: String,

    // Session data
    sessionId: String,
    sessionPosition: Number,

    // Quality metrics
    bufferCount: { type: Number, default: 0 },
    qualityDrops: { type: Number, default: 0 },
    networkType: String,

    // Timestamps
    timestamp: { type: Date, default: Date.now },
    endedAt: Date,

    status: {
      type: String,
      enum: ['started', 'playing', 'paused', 'completed', 'skipped'],
      default: 'started',
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Track day for easier analytics aggregation
    day: {
      type: String,
      default: function () {
        const date = this.timestamp || new Date();
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      },
    },

    // Flag to determine if this is an aggregated record or individual play
    isAggregated: { type: Boolean, default: false },

    // Configuration flag to control storage behavior
    storeDetailedMetrics: { type: Boolean, default: true },

    // Add a field to track the rate of updates
    updateCount: {
      type: Number,
      default: 0,
    },

    // Track last update time to prevent rapid updates
    lastUpdateTime: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
PlayEventSchema.index({ userId: 1, trackId: 1 });
PlayEventSchema.index({ timestamp: -1 });
PlayEventSchema.index({ day: 1 });
PlayEventSchema.index({ sessionId: 1 });
PlayEventSchema.index({ isAggregated: 1, userId: 1, trackId: 1, day: 1 });

/**
 * Static method to track plays with extreme throttling to prevent DB flooding
 */
PlayEventSchema.statics.logPlay = async function (playData) {
  const {
    userId,
    trackId,
    sessionId,
    duration,
    title,
    completed,
    skipped,
    liked,
    shared,
    repeated,
    listenDuration,
    // Other fields
    deviceType,
    source,
    artist,
    album,
    genre,
    year,
    storeDetailedMetrics = false, // Default to NOT storing detailed metrics
  } = playData;

  // Create cache key using combination of user, track and session
  const cacheKey = `play_${userId || 'anon'}_${trackId}_${
    sessionId || 'nosession'
  }`;

  // Check if we've processed this recently (within 10 seconds)
  if (playCache.get(cacheKey)) {
    // Silently throttle without logging
    return {
      _id: playCache.get(cacheKey),
      trackId,
      throttled: true,
    };
  }

  // Decide whether to store as individual event or aggregate
  // We now default to aggregation (storeDetailedMetrics = false)
  if (!storeDetailedMetrics) {
    const today = new Date().toISOString().split('T')[0];

    // Aggregate data by user, track, and day
    const filter = {
      userId,
      trackId,
      day: today,
      isAggregated: true,
    };

    // Only store essential fields in the update
    const update = {
      $setOnInsert: {
        trackUrl: playData.trackUrl,
        title: playData.title,
        isAggregated: true,
        storeDetailedMetrics: false,
      },
      $inc: {
        'playMetrics.count': 1,
        updateCount: 1,
      },
      $set: {
        'playMetrics.lastPlayed': new Date(),
        lastUpdateTime: new Date(),
      },
    };

    // Only conditionally add duration data if it's available and valid
    if (playData.duration && typeof playData.duration === 'number') {
      update.$inc['playMetrics.totalDuration'] = playData.duration;
    }

    // Use findOneAndUpdate with upsert to avoid duplicate documents
    const result = await this.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });

    // Cache this event ID to prevent duplicates
    playCache.set(cacheKey, result._id.toString());
    return result;
  }

  // For detailed metrics (rare cases), throttle writes and create individual entry
  const result = await this.create({
    ...playData,
    updateCount: 1,
    lastUpdateTime: new Date(),
  });

  // Cache this event ID to prevent duplicates
  playCache.set(cacheKey, result._id.toString());
  return result;
};

/**
 * Static method to update play events with rate limiting
 */
PlayEventSchema.statics.updatePlayWithThrottle = async function (
  playEventId,
  userId,
  updateData,
) {
  // Create cache key for this update operation
  const cacheKey = `update_${playEventId}_${userId}`;

  // Check if we've updated this recently
  if (playCache.get(cacheKey)) {
    // Silently throttle without logging
    return {
      _id: playEventId,
      throttled: true,
    };
  }

  // Find the document to update
  const playEvent = await this.findOne({ _id: playEventId, userId });

  if (!playEvent) {
    return null; // Not found
  }

  // Check if this document has been updated too frequently
  const now = new Date();
  const timeSinceLastUpdate = now - playEvent.lastUpdateTime;

  // If we've updated this document too recently (less than 5 seconds ago)
  // and it's already been updated multiple times, skip this update
  if (timeSinceLastUpdate < 5000 && playEvent.updateCount > 2) {
    // Apply rate limiting silently
    return {
      _id: playEventId,
      rateLimited: true,
    };
  }

  // Perform the update
  const result = await this.findOneAndUpdate(
    { _id: playEventId, userId },
    {
      $set: {
        ...updateData,
        lastUpdateTime: now,
      },
      $inc: { updateCount: 1 },
    },
    { new: true },
  );

  // Cache this update to prevent duplicates
  playCache.set(cacheKey, true, 5); // Cache for 5 seconds
  return result;
};

/**
 * Static method to batch update play events with extreme throttling
 */
PlayEventSchema.statics.batchUpdateWithThrottle = async function (
  updates,
  userId,
  session,
) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  // Filter out updates that have been throttled recently
  const filteredUpdates = updates.filter((update) => {
    const cacheKey = `batch_${update.playEventId}_${userId}`;
    if (playCache.get(cacheKey)) {
      return false; // Skip this update
    }
    playCache.set(cacheKey, true, 10); // Cache for 10 seconds
    return true;
  });

  // If all updates were filtered out, return early
  if (filteredUpdates.length === 0) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  // For remaining updates, use bulkWrite
  const bulkOps = filteredUpdates.map((event) => ({
    updateOne: {
      filter: { _id: event.playEventId, userId },
      update: {
        $set: {
          ...(event.progress !== undefined && { progress: event.progress }),
          ...(event.status !== undefined && { status: event.status }),
          ...(event.endTimestamp !== undefined && {
            endTimestamp: event.endTimestamp,
          }),
          lastUpdateTime: new Date(),
        },
        $inc: { updateCount: 1 },
      },
    },
  }));

  const options = session ? { session } : {};
  return this.bulkWrite(bulkOps, options);
};

module.exports = mongoose.model('PlayEvent', PlayEventSchema);
