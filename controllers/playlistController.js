const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const PlayEvent = require('../models/PlayEvent');

const readdir = promisify(fs.readdir);

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

/**
 * Extract audio file links from HTML content
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {Array} - Array of track objects with title, url, and mime type
 */
// Export for testing
exports.extractMp3Links = (html, baseUrl) => {
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
exports.validateUrl = (url) => {
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
exports.getPlaylistFromRemoteFolder = async (url) => {
  try {
    // Validate and sanitize URL
    const validatedUrl = exports.validateUrl(url);

    const response = await axios.get(validatedUrl);
    return exports.extractMp3Links(response.data, validatedUrl);
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
exports.validateFolderPath = (folderPath) => {
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
exports.getPlaylistFromLocalFolder = async (folderPath, req) => {
  try {
    // Validate and sanitize folder path
    const sanitizedFolderPath = exports.validateFolderPath(folderPath);

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
 * @desc    Get playlist from remote URL or local folder
 * @route   GET /api/playlist
 * @access  Public
 */
exports.getPlaylist = async (req, res) => {
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
      tracks = await exports.getPlaylistFromRemoteFolder(url);
    } else if (folder) {
      // Get playlist from local folder
      tracks = await exports.getPlaylistFromLocalFolder(folder, req);
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

// Log a play event
exports.logPlay = async (req, res) => {
  const { trackUrl, title, duration } = req.body;

  if (!trackUrl) {
    return res.status(400).json({ error: 'trackUrl required' });
  }

  try {
    await PlayEvent.create({
      userId: req.userId,
      trackUrl,
      title,
      duration,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error logging play event:', error);
    res.status(500).json({ error: 'Server error, failed to log play event' });
  }
};
