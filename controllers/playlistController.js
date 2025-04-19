const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);

/**
 * Extract MP3 links from HTML content
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {Array} - Array of track objects with title and url
 */
// Export for testing
exports.extractMp3Links = (html, baseUrl) => {
  const $ = cheerio.load(html);
  const tracks = [];

  // Find all links (a tags) in the HTML
  $('a').each((i, element) => {
    const href = $(element).attr('href');

    // Check if the link points to an MP3 file
    if (href && href.toLowerCase().endsWith('.mp3')) {
      // Resolve relative URLs
      const fullUrl = new URL(href, baseUrl).toString();

      // Extract title from the link text or filename
      let title = $(element).text().trim();
      if (!title || title === href) {
        // If no meaningful text, use the filename without extension
        const fileExt = path.extname(href);
        const baseName = path.basename(href, fileExt);
        // Convert dashes and underscores to spaces and capitalize words
        title = baseName
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());
      }

      tracks.push({ title, url: fullUrl });
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
 * @param {string} folderPath - Path to folder containing MP3 files
 * @param {object} req - Express request object for building URLs
 * @returns {Promise<Array>} - Array of track objects with title and url
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

    // Filter for MP3 files and create track objects
    const tracks = files
      .filter((file) => file.toLowerCase().endsWith('.mp3'))
      .map((file) => {
        // Create a title from the filename - handle case-insensitive extension
        const fileExt = path.extname(file);
        const baseName = path.basename(file, fileExt);
        const title = baseName
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());

        // Build the URL relative to the app domain
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        // Ensure forward slashes for URL paths
        const urlPath =
          `${publicMusicPath}/${sanitizedFolderPath}/${file}`.replace(
            /\\/g,
            '/',
          );
        const url = `${baseUrl}/${urlPath}`;

        return { title, url };
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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
