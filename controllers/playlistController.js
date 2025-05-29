// Import required modules
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const mongoose = require('mongoose');

// Promisify fs.readdir
const readdir = promisify(fs.readdir);

// Import models safely with try/catch to handle errors gracefully
let PlayEvent;

try {
  PlayEvent = require('../models/PlayEvent');
} catch (error) {
  console.warn('Warning: PlayEvent model not found or has errors');
}

// Supported audio MIME types for file extensions:
const mimeTypes = {
  mp3: 'audio/mpeg',
  wav: 'audio/x-wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  mp4: 'video/mp4',
};

// Helper function to detect device type from user agent
const detectDeviceTypeFromUserAgent = (userAgent) => {
  if (!userAgent) return 'unknown';

  if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) return 'mobile';
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/smart-tv|hbbtv|netcast|viera|nettv|roku/i.test(userAgent)) return 'tv';
  return 'desktop';
};

/**
 * Extract audio file links from HTML content
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {Array} - Array of track objects with title, url, and mime type
 */
// Export for testing
const extractMp3Links = (html, baseUrl) => {
  const $ = cheerio.load(html);
  const tracks = [];

  // Supported file extensions
  const supportedExtensions = /\.(mp3|wav|m4a|ogg|flac|aac|mp4)$/i;

  // Find all links (a tags) in the HTML
  $('a').each((i, element) => {
    const href = $(element).attr('href');

    // Check if the link points to a supported audio file
    if (href && supportedExtensions.test(href)) {
      // Resolve relative URLs and encode the full URL
      const fullUrl = encodeURI(new URL(href, baseUrl).href);

      // Get the filename and extension
      const fileName = href.split('/').pop();
      const ext = path.extname(fileName).replace('.', '').toLowerCase();

      // Extract title from the link text or filename
      let title = $(element).text().trim();
      if (!title || title === href) {
        // If no meaningful text, use the filename without extension
        title = decodeURIComponent(
          fileName
            .replace(/\.[^/.]+$/, '') // strip extension
            .replace(/[-_]/g, ' '), // replace dashes/underscores with spaces
        )
          .trim()
          // Capitalize first letter of each word
          .replace(/\b\w/g, (char) => char.toUpperCase());
      }

      tracks.push({
        title,
        url: fullUrl,
        mime: mimeTypes[ext] || 'audio/*',
      });
    }
  });

  return tracks;
};

/**
 * Validate and sanitize URL
 * @param {string} url - URL to validate
 * @returns {string} - Sanitized URL
 * @throws {Error} - If URL is invalid
 */
// Export for testing
const validateUrl = (url) => {
  // Check if URL is valid
  try {
    const urlObj = new URL(url);

    // Ensure URL uses http or https protocol first
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('URL must use HTTP or HTTPS protocol');
    }

    // Add more strict validation for URL format
    if (!url.match(/^https?:\/\/[a-zA-Z0-9][\w-.]+\.[a-zA-Z]{2,}(\/.*)?$/)) {
      throw new Error('URL format is invalid');
    }

    // Additional security checks could be added here
    // For example, whitelist domains, check for suspicious patterns, etc.

    return urlObj.toString();
  } catch (error) {
    // Preserve original error message for protocol errors
    if (error.message === 'URL must use HTTP or HTTPS protocol') {
      throw error;
    }
    throw new Error(`Invalid URL: ${error.message}`);
  }
};

/**
 * Get playlist from remote URL
 * @param {string} url - URL to fetch playlist from
 * @returns {Promise<Array>} - Array of track objects with title and url
 */
// Export for testing
const getPlaylistFromRemoteFolder = async (url) => {
  try {
    // Validate and sanitize URL
    const validatedUrl = validateUrl(url);

    const response = await axios.get(validatedUrl);
    return extractMp3Links(response.data, validatedUrl);
  } catch (error) {
    throw new Error(`Failed to fetch remote playlist: ${error.message}`);
  }
};

/**
 * Validate and sanitize folder path
 * @param {string} folderPath - Folder path to validate
 * @returns {string} - Sanitized folder path
 * @throws {Error} - If folder path is invalid
 */
// Export for testing
const validateFolderPath = (folderPath) => {
  // Remove leading slashes
  let sanitizedPath = folderPath.replace(/^\/+/, '');

  // Normalize path to handle different formats
  sanitizedPath = path.normalize(sanitizedPath);

  // Convert Windows backslashes to forward slashes for consistency
  sanitizedPath = sanitizedPath.replace(/\\/g, '/');

  // Remove trailing slashes
  sanitizedPath = sanitizedPath.replace(/\/+$/, '');

  // Prevent directory traversal attacks
  if (sanitizedPath.includes('..')) {
    throw new Error('Directory traversal is not allowed');
  }

  // Whitelist allowed folders (optional)
  // For now, we'll allow any folder under public/music
  // You could restrict this further if needed

  return sanitizedPath;
};

/**
 * Get playlist from local folder
 * @param {string} folderPath - Path to folder containing audio files
 * @param {object} req - Express request object for building URLs
 * @returns {Promise<Array>} - Array of track objects with title, url, and mime type
 */
// Export for testing
const getPlaylistFromLocalFolder = async (folderPath, req) => {
  try {
    // Validate and sanitize folder path
    const sanitizedFolderPath = validateFolderPath(folderPath);

    // Ensure the folder path is within the public directory
    const publicMusicPath = path.join('public', 'music');
    const fullPath = path.join(publicMusicPath, sanitizedFolderPath);

    // Read the directory contents
    const files = await readdir(fullPath);

    // Supported file extensions
    const supportedExtensions = /\.(mp3|wav|m4a|ogg|flac|aac|mp4)$/i;

    // Filter for supported audio files and create track objects
    const tracks = files
      .filter((file) => supportedExtensions.test(file))
      .map((file) => {
        // Get the extension
        const ext = path.extname(file).replace('.', '').toLowerCase();

        // Create a title from the filename
        const title = decodeURIComponent(
          file
            .replace(/\.[^/.]+$/, '') // strip extension
            .replace(/[-_]/g, ' '), // replace dashes/underscores with spaces
        )
          .trim()
          // Capitalize first letter of each word
          .replace(/\b\w/g, (char) => char.toUpperCase());

        // Build the URL relative to the app domain
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        // Ensure forward slashes for URL paths
        const urlPath =
          `${publicMusicPath}/${sanitizedFolderPath}/${file}`.replace(
            /\\/g,
            '/',
          );
        // Encode the URL
        const url = encodeURI(`${baseUrl}/${urlPath}`);

        return {
          title,
          url,
          mime: mimeTypes[ext] || 'audio/*',
        };
      });

    return tracks;
  } catch (error) {
    throw new Error(`Failed to read local playlist: ${error.message}`);
  }
};

/**
 * Get playlist from remote URL or local folder
 * @desc    Get playlist from remote URL or local folder
 * @route   GET /api/playlist
 * @access  Public
 */
const getPlaylist = async (req, res) => {
  const { url, folder } = req.query;

  // Validate that either url or folder is provided
  if (!url && !folder) {
    return res.status(400).json({
      success: false,
      message: 'Either url or folder parameter is required',
    });
  }

  try {
    let tracks = [];

    if (url) {
      // Get playlist from remote URL
      tracks = await getPlaylistFromRemoteFolder(url);
    } else if (folder) {
      // Get playlist from local folder
      tracks = await getPlaylistFromLocalFolder(folder, req);
    }

    return res.status(200).json({
      success: true,
      count: tracks.length,
      data: tracks,
    });
  } catch (error) {
    console.error('[Playlist Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Log a play event with enhanced analytics data
 * Optimized to minimize database writes with strict throttling
 */
const logPlay = async (req, res) => {
  const {
    trackUrl,
    trackId,
    title,
    duration,
    // Enhanced analytics fields
    artist,
    album,
    genre,
    year,
    // Playback context
    source,
    playlistId,
    previousTrack,
    nextTrack,
    // Session data
    sessionId,
    sessionPosition,
    // Quality metrics
    networkType,
    // Storage configuration
    storeDetailedMetrics = true, // Set to false to use aggregation and reduce DB entries
  } = req.body;

  // Check for either trackId or trackUrl
  const finalTrackId = trackId || trackUrl;
  if (!finalTrackId) {
    return res.status(400).json({ error: 'trackId or trackUrl is required' });
  }

  try {
    // Generate a session-specific key to detect duplicates
    const userKey = req.user ? req.user.id : req.userId || 'anonymous';
    const sessionKey =
      req.body.sessionId || req.headers['x-session-id'] || 'default';

    // Use in-memory cache before even attempting DB operation
    const requestKey = `${userKey}_${finalTrackId}_${sessionKey}`;

    // Static in-memory tracker to prevent DB access for frequent requests
    if (!logPlay.recentRequests) logPlay.recentRequests = {};

    // Check if we've seen this exact request in the past 10 seconds
    const now = Date.now();
    if (
      logPlay.recentRequests[requestKey] &&
      now - logPlay.recentRequests[requestKey] < 10000
    ) {
      // 10 seconds

      // Return success but indicate it was throttled
      return res.status(200).json({
        success: true,
        throttled: true,
        message: 'Request throttled to prevent excessive database writes',
      });
    }

    // Update our in-memory record of this request
    logPlay.recentRequests[requestKey] = now;

    // Clean up old entries from the recentRequests object every 100 requests
    if (Object.keys(logPlay.recentRequests).length > 100) {
      const tenSecondsAgo = now - 10000;
      Object.keys(logPlay.recentRequests).forEach((key) => {
        if (logPlay.recentRequests[key] < tenSecondsAgo) {
          delete logPlay.recentRequests[key];
        }
      });
    }

    // Determine device type
    let finalDeviceType = req.body.deviceType;
    if (!finalDeviceType || finalDeviceType === 'unknown') {
      const userAgent = req.headers['user-agent'];
      finalDeviceType = detectDeviceTypeFromUserAgent(userAgent);
    }

    // Prepare play data - but keep it minimal to avoid excessive DB size
    const playData = {
      userId: req.user ? req.user.id : req.userId,
      trackId: finalTrackId,
      trackUrl: trackUrl || finalTrackId,
      title,
      duration,
      sessionId,
      deviceType: finalDeviceType,
      // Simplified data to reduce DB size
      source: req.body.source || 'direct',
      // Default to NOT storing detailed metrics to reduce DB writes
      storeDetailedMetrics: false,
    };

    // Use the optimized and throttled method for logging plays
    const playEvent = await PlayEvent.logPlay(playData);

    res.status(201).json({
      success: true,
      playEventId: playEvent._id,
      throttled: playEvent.throttled,
    });
  } catch (error) {
    console.error('Error logging play event:', error);
    res.status(500).json({
      error: 'Server error, failed to log play event',
    });
  }
};

/**
 * Update a play event with progress/completion data
 * Only update necessary fields, with extreme throttling
 */
const updatePlayEvent = async (req, res) => {
  const { playEventId } = req.params;
  const { progress, status, endTimestamp } = req.body;

  try {
    const userId = req.user ? req.user.id : req.userId;

    // Only include critical fields in the update to minimize DB load
    const updateData = {};
    if (progress !== undefined) updateData.progress = progress;
    if (status !== undefined) updateData.status = status;
    if (endTimestamp) updateData.endTimestamp = new Date(endTimestamp);

    // Use throttled update method to prevent excess writes
    const result = await PlayEvent.updatePlayWithThrottle(
      playEventId,
      userId,
      updateData,
    );

    if (!result) {
      return res.status(404).json({ error: 'Play event not found' });
    }

    res.status(200).json({
      success: true,
      throttled: result.throttled || result.rateLimited,
    });
  } catch (error) {
    console.error('Error updating play event:', error);
    res
      .status(500)
      .json({ error: 'Server error, failed to update play event' });
  }
};

/**
 * Batch update multiple play events with extreme throttling
 */
const batchUpdatePlayEvents = async (req, res) => {
  let session;

  try {
    const { playEvents } = req.body;
    const userId = req.user ? req.user.id : req.userId;

    if (!Array.isArray(playEvents) || playEvents.length === 0) {
      return res
        .status(400)
        .json({ message: 'Valid array of play events is required' });
    }

    // Limit the number of events to process
    const limitedEvents = playEvents.slice(0, 10); // Only process up to 10 events at once

    session = await mongoose.startSession();
    session.startTransaction();

    // Use the throttled batch update method
    const result = await PlayEvent.batchUpdateWithThrottle(
      limitedEvents,
      userId,
      session,
    );

    // For aggregated metrics, only update once at most by collecting stats
    const stats = {
      completions: limitedEvents.filter((e) => e.completed).length,
      skips: limitedEvents.filter((e) => e.skipped).length,
      totalListenDuration: limitedEvents.reduce(
        (sum, e) => sum + (e.listenDuration || 0),
        0,
      ),
    };

    if (
      stats.completions > 0 ||
      stats.skips > 0 ||
      stats.totalListenDuration > 0
    ) {
      // Get unique track IDs
      const uniqueTrackIds = [
        ...new Set(
          limitedEvents.filter((e) => e.trackId).map((e) => e.trackId),
        ),
      ];

      // Update aggregated metrics for these tracks, just once
      for (const trackId of uniqueTrackIds) {
        const eventsForTrack = limitedEvents.filter(
          (e) => e.trackId === trackId,
        );
        const trackStats = {
          completions: eventsForTrack.filter((e) => e.completed).length,
          skips: eventsForTrack.filter((e) => e.skipped).length,
          listenDuration: eventsForTrack.reduce(
            (sum, e) => sum + (e.listenDuration || 0),
            0,
          ),
        };

        // Only update if we have meaningful stats
        if (
          trackStats.completions > 0 ||
          trackStats.skips > 0 ||
          trackStats.listenDuration > 0
        ) {
          await PlayEvent.findOneAndUpdate(
            {
              userId,
              trackId,
              isAggregated: true,
              day: new Date().toISOString().split('T')[0],
            },
            {
              $inc: {
                'playMetrics.completions': trackStats.completions,
                'playMetrics.skips': trackStats.skips,
                'playMetrics.totalListenTime': trackStats.listenDuration,
              },
              $set: { lastUpdateTime: new Date() },
            },
            { upsert: true, session },
          );
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      processed: limitedEvents.length,
      skipped: playEvents.length - limitedEvents.length,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }

    console.error('Error batch updating play events:', error);
    return res
      .status(500)
      .json({ message: 'Server error during batch update' });
  }
};

/**
 * Log user interactions using PlayEvent model
 */
const logInteraction = async (req, res) => {
  try {
    const { trackId, interactionType, timestamp, value } = req.body;
    const userId = req.userId;

    console.log('=== INTERACTION LOG REQUEST ===');
    console.log('Request body:', req.body);
    console.log('User ID:', userId);
    console.log('Track ID:', trackId);
    console.log('Interaction Type:', interactionType);
    console.log('Value:', value);

    if (!trackId || !interactionType) {
      console.log('Missing required fields');
      return res
        .status(400)
        .json({ message: 'Track ID and interaction type are required' });
    }

    if (!userId) {
      console.log('User not authenticated');
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!PlayEvent) {
      console.error('PlayEvent model not available');
      return res.status(500).json({ message: 'PlayEvent model not available' });
    }

    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const today = new Date().toISOString().split('T')[0];

    if (interactionType === 'like') {
      if (value === false) {
        // User is unliking - update the PlayEvent to remove like
        const result = await PlayEvent.findOneAndUpdate(
          {
            userId: userObjectId,
            trackId,
            day: today,
            isAggregated: true,
          },
          {
            $set: {
              liked: false,
              lastUpdateTime: new Date(),
            },
            $inc: {
              'playMetrics.likes': -1,
            },
          },
          { new: true },
        );

        console.log(
          'Like removed from PlayEvent:',
          result ? result._id : 'not found',
        );

        return res.status(200).json({
          success: true,
          action: 'unliked',
          playEventId: result ? result._id : null,
        });
      } else {
        // User is liking - update or create PlayEvent with like
        const result = await PlayEvent.findOneAndUpdate(
          {
            userId: userObjectId,
            trackId,
            day: today,
            isAggregated: true,
          },
          {
            $set: {
              liked: true,
              lastUpdateTime: new Date(),
            },
            $inc: {
              'playMetrics.likes': 1,
            },
            $setOnInsert: {
              isAggregated: true,
              storeDetailedMetrics: false,
              'playMetrics.count': 0,
            },
          },
          { new: true, upsert: true },
        );

        console.log('Like added to PlayEvent:', result._id);

        return res.status(201).json({
          success: true,
          action: 'liked',
          playEventId: result._id,
        });
      }
    } else if (interactionType === 'share') {
      const result = await PlayEvent.findOneAndUpdate(
        {
          userId: userObjectId,
          trackId,
          day: today,
          isAggregated: true,
        },
        {
          $set: {
            shared: true,
            lastUpdateTime: new Date(),
          },
          $inc: {
            'playMetrics.shares': 1,
          },
          $setOnInsert: {
            isAggregated: true,
            storeDetailedMetrics: false,
            'playMetrics.count': 0,
          },
        },
        { new: true, upsert: true },
      );

      console.log('Share interaction saved to PlayEvent:', result._id);

      return res.status(201).json({
        success: true,
        action: 'shared',
        playEventId: result._id,
      });
    } else if (interactionType === 'repeat') {
      const result = await PlayEvent.findOneAndUpdate(
        {
          userId: userObjectId,
          trackId,
          day: today,
          isAggregated: true,
        },
        {
          $set: {
            repeated: true,
            lastUpdateTime: new Date(),
          },
          $inc: {
            'playMetrics.repeats': 1,
          },
          $setOnInsert: {
            isAggregated: true,
            storeDetailedMetrics: false,
            'playMetrics.count': 0,
          },
        },
        { new: true, upsert: true },
      );

      console.log('Repeat interaction saved to PlayEvent:', result._id);

      return res.status(201).json({
        success: true,
        action: 'repeated',
        playEventId: result._id,
      });
    } else {
      console.log(
        `Interaction type '${interactionType}' not specifically handled`,
      );
      return res.status(200).json({
        success: true,
        message: `Interaction type '${interactionType}' logged`,
      });
    }
  } catch (error) {
    console.error('Error logging interaction:', error);
    return res
      .status(500)
      .json({ message: 'Server error while logging interaction' });
  }
};

/**
 * Get user's liked tracks using PlayEvent model
 */
const getUserLikes = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!PlayEvent) {
      console.error('PlayEvent model not available');
      return res.status(500).json({ message: 'PlayEvent model not available' });
    }

    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    // Get all liked tracks for the user from PlayEvent
    const likedTracks = await PlayEvent.find({
      userId: userObjectId,
      liked: true,
      isAggregated: true,
    }).select('trackId timestamp');

    // Convert to a simple object for easy lookup
    const likesMap = {};
    likedTracks.forEach((playEvent) => {
      likesMap[playEvent.trackId] = {
        liked: true,
        timestamp: playEvent.timestamp,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        likes: likesMap,
        count: likedTracks.length,
      },
    });
  } catch (error) {
    console.error('Error getting user likes:', error);
    return res
      .status(500)
      .json({ message: 'Server error while getting user likes' });
  }
};

// Export all functions consistently using module.exports
module.exports = {
  getPlaylist,
  logPlay,
  updatePlayEvent,
  batchUpdatePlayEvents,
  logInteraction,
  getUserLikes,
  // Export utility functions as well so they can be used by other controllers
  extractMp3Links,
  validateUrl,
  getPlaylistFromRemoteFolder,
  validateFolderPath,
  getPlaylistFromLocalFolder,
};
