const express = require('express');
const router = express.Router();
const { getPlaylist } = require('../controllers/playlistController');

/**
 * @route   GET /api/playlist
 * @desc    Get playlist from remote URL or local folder
 * @access  Public
 */
router.get('/', getPlaylist);

module.exports = router;
